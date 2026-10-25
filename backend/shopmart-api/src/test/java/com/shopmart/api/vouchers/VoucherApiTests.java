package com.shopmart.api.vouchers;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import com.shopmart.api.security.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
@WebMvcTest(controllers={VoucherController.class,AdminVoucherController.class})
@Import({SecurityConfig.class,MobileApiSecurityConfig.class,VoucherErrors.class,VoucherApiTests.Security.class})
class VoucherApiTests {
 @TestConfiguration(proxyBeanMethods=false) @EnableWebSecurity static class Security{}
 @Autowired MockMvc mvc;
 @MockitoBean JwtDecoder decoder;
 @MockitoBean VoucherService vouchers;
 @MockitoBean AdminVoucherService admin;
 final UUID user=UUID.randomUUID(),product=UUID.randomUUID();
 void token(String role){when(decoder.decode("test-token")).thenReturn(Jwt.withTokenValue("test-token").header("alg","test").subject(user.toString()).issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(60)).claim("roles",List.of(role)).build());}
 @Test void unsignedCustomerCannotQuoteOrManageVouchers()throws Exception{
  mvc.perform(post("/api/mobile/vouchers/quote").contentType("application/json").content("{}")).andExpect(status().isUnauthorized());
  mvc.perform(get("/api/mobile/admin/vouchers")).andExpect(status().isUnauthorized());verifyNoInteractions(vouchers,admin);
 }
 @ParameterizedTest @ValueSource(strings={"CUSTOMER","RIDER"})
 void customersAndRidersCannotManageVouchers(String role)throws Exception{token(role);for(String path:List.of("/api/admin/vouchers","/api/mobile/admin/vouchers")){mvc.perform(get(path).header("Authorization","Bearer test-token")).andExpect(status().isForbidden());mvc.perform(post(path).header("Authorization","Bearer test-token").contentType("application/json").content("{}")).andExpect(status().isForbidden());mvc.perform(patch(path+"/"+product).header("Authorization","Bearer test-token").contentType("application/json").content("{}")).andExpect(status().isForbidden());}verifyNoInteractions(admin);}
 @Test void customerGetsCanonicalQuoteWithNoStoredRedemption()throws Exception{token("CUSTOMER");when(vouchers.quote(eq(user),any())).thenReturn(new VoucherService.Quote("SAVE10","1000.00","100.00","900.00","PKR"));mvc.perform(post("/api/mobile/vouchers/quote").header("Authorization","Bearer test-token").contentType("application/json").content("{\"code\":\"SAVE10\",\"items\":[{\"productId\":\""+product+"\",\"quantity\":1}]}" )).andExpect(status().isOk()).andExpect(jsonPath("$.total").value("900.00"));}
 @Test void failedVoucherShowsUsefulMessage()throws Exception{token("CUSTOMER");when(vouchers.quote(eq(user),any())).thenThrow(new VoucherService.Rejected("This voucher has expired."));mvc.perform(post("/api/mobile/vouchers/quote").header("Authorization","Bearer test-token").contentType("application/json").content("{\"code\":\"EXPIRED\",\"items\":[{\"productId\":\""+product+"\",\"quantity\":1}]}" )).andExpect(status().isConflict()).andExpect(jsonPath("$.message").value("This voucher has expired."));}
 @Test void adminCanListAndToggleUsingVersion()throws Exception{token("ADMIN");when(admin.list(user,0,20)).thenReturn(new AdminVoucherService.Page(List.of(),0,20,0,0));mvc.perform(get("/api/mobile/admin/vouchers").header("Authorization","Bearer test-token")).andExpect(status().isOk());mvc.perform(patch("/api/mobile/admin/vouchers/"+product).header("Authorization","Bearer test-token").contentType("application/json").content("{\"enabled\":false,\"version\":2}")).andExpect(status().isNoContent());verify(admin).toggle(user,product,new AdminVoucherService.ToggleRequest(false,2L));}
 @Test void invalidQuantitiesCannotReachQuoteService()throws Exception{token("CUSTOMER");mvc.perform(post("/api/mobile/vouchers/quote").header("Authorization","Bearer test-token").contentType("application/json").content("{\"code\":\"SAVE10\",\"items\":[{\"productId\":\""+product+"\",\"quantity\":0}]}" )).andExpect(status().isBadRequest());verifyNoInteractions(vouchers);}
 @Test void missingJwtSubjectIsUnauthorizedInsteadOfServerError(){
  var jwt=Jwt.withTokenValue("test-token").header("alg","test").claim("roles",List.of("CUSTOMER")).build();
  var failure=org.junit.jupiter.api.Assertions.assertThrows(org.springframework.web.server.ResponseStatusException.class,()->VoucherController.user(jwt));
  org.junit.jupiter.api.Assertions.assertEquals(401,failure.getStatusCode().value());
 }

}
