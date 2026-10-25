package com.shopmart.api.admin;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import com.shopmart.api.auth.PasswordController;
import com.shopmart.api.auth.PasswordService;
import com.shopmart.api.auth.RefreshCookieService;
import com.shopmart.api.catalog.ProductImageController;
import com.shopmart.api.catalog.ProductImageService;
import com.shopmart.api.cod.AdminCodController;
import com.shopmart.api.cod.RiderCodService;
import com.shopmart.api.delivery.AdminDeliveryController;
import com.shopmart.api.delivery.DeliveryService;
import com.shopmart.api.delivery.WarehouseController;
import com.shopmart.api.delivery.WarehouseService;
import com.shopmart.api.returns.*;
import com.shopmart.api.reviews.AdminReviewController;
import com.shopmart.api.reviews.AdminReviewService;
import com.shopmart.api.security.MobileApiSecurityConfig;
import com.shopmart.api.security.SecurityConfig;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpMethod;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers={AdminProductController.class,AdminCategoryController.class,AdminUserController.class,
    ProductImageController.class,PasswordController.class,AdminDeliveryController.class,WarehouseController.class,
    AdminReturnController.class,AdminRefundController.class,AdminReviewController.class,AdminCodController.class})
@Import({SecurityConfig.class,MobileApiSecurityConfig.class,MobileAdminModulesTests.WebSecurity.class})
class MobileAdminModulesTests {
  @TestConfiguration(proxyBeanMethods=false) @EnableWebSecurity static class WebSecurity {}
  @Autowired MockMvc mvc;
  @MockitoBean JwtDecoder decoder;
  @MockitoBean AdminProductService products;
  @MockitoBean AdminCategoryService categories;
  @MockitoBean AdminUserService users;
  @MockitoBean ProductImageService images;
  @MockitoBean PasswordService passwords;
  @MockitoBean RefreshCookieService cookies;
  @MockitoBean DeliveryService deliveries;
  @MockitoBean WarehouseService warehouse;
  @MockitoBean AdminReturnService returns;
  @MockitoBean AdminRefundService refunds;
  @MockitoBean AdminReviewService reviews;
  @MockitoBean RiderCodService cash;
  @MockitoBean JdbcTemplate jdbc;
  private static final UUID ADMIN=UUID.fromString("00000000-0000-0000-0000-000000000001");
  private static final UUID ID=UUID.fromString("00000000-0000-0000-0000-000000000002");
  private static final UUID RIDER=UUID.fromString("00000000-0000-0000-0000-000000000003");
  private static final String BASE="/api/mobile/admin";
  private void token(String role) {
    when(decoder.decode("test-token")).thenReturn(Jwt.withTokenValue("test-token").header("alg","test-only")
        .subject(ADMIN.toString()).issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(120))
        .claim("roles",List.of(role)).build());
  }
  private String[][] routes(){return new String[][]{
    {"GET","/products"},{"POST","/products"},{"PUT","/products/"+ID},{"DELETE","/products/"+ID+"?version=4"},
    {"GET","/products/"+ID+"/images"},{"POST","/products/"+ID+"/images"},
    {"PATCH","/products/"+ID+"/images/"+ID+"/primary"},{"DELETE","/products/"+ID+"/images/"+ID},
    {"POST","/categories"},{"PUT","/categories/"+ID},{"DELETE","/categories/"+ID},
    {"GET","/users"},{"POST","/users/riders"},{"PATCH","/users/"+ID+"/enabled"},{"PATCH","/users/"+ID+"/password"},
    {"GET","/deliveries"},{"PATCH","/deliveries/"+ID+"/details"},{"GET","/deliveries/"+ID+"/warehouse"},
    {"PATCH","/deliveries/"+ID+"/warehouse-receipt"},{"POST","/deliveries/"+ID+"/resolution"},
    {"GET","/returns"},{"PATCH","/returns/"+ID+"/status"},{"POST","/returns/"+ID+"/refund"},
    {"GET","/reviews"},{"PATCH","/reviews/"+ID+"/visibility"},
    {"GET","/cod/handovers"},{"GET","/cod/handovers/"+ID},{"PATCH","/cod/handovers/"+ID}};}

  @Test void anonymousCannotAccessAnyRemainingModule() throws Exception {
    for(var route:routes())mvc.perform(request(HttpMethod.valueOf(route[0]),BASE+route[1]).contentType("application/json").content("{}"))
        .andExpect(status().isUnauthorized());
    verifyNoInteractions(products,categories,users,images,passwords,deliveries,warehouse,returns,refunds,reviews,cash,jdbc);
  }
  @ParameterizedTest @ValueSource(strings={"CUSTOMER","RIDER"})
  void nonAdminsCannotAccessAnyRemainingModule(String role) throws Exception {
    token(role);
    for(var route:routes())mvc.perform(request(HttpMethod.valueOf(route[0]),BASE+route[1]).header("Authorization","Bearer test-token").contentType("application/json").content("{}"))
        .andExpect(status().isForbidden());
    verifyNoInteractions(products,categories,users,images,passwords,deliveries,warehouse,returns,refunds,reviews,cash,jdbc);
  }
  @Test void adminCanReadAllPaginatedModules() throws Exception {
    token("ADMIN");
    for(String path:List.of("/products","/users","/deliveries","/returns","/reviews","/cod/handovers"))
      mvc.perform(get(BASE+path).header("Authorization","Bearer test-token")).andExpect(status().isOk())
          .andExpect(header().string("Cache-Control","no-store"));
    verify(products).list(ADMIN,0,20);verify(users).list(ADMIN,0,10,"","ALL");verify(deliveries).list(ADMIN,0,20);
    verify(returns).list(ADMIN,0,20);verify(reviews).list(ADMIN,0,20);verify(cash).history(ADMIN,true,"PENDING",0,20);
  }
  @Test void productUpdatePreservesVersionAndExactPrice() throws Exception {
    token("ADMIN");
    mvc.perform(put(BASE+"/products/"+ID).header("Authorization","Bearer test-token").contentType("application/json")
        .content("{\"name\":\"Test product\",\"categoryId\":\""+ID+"\",\"price\":\"1200.50\",\"stock\":4,\"active\":true,\"version\":7,\"description\":\"Description\"}"))
        .andExpect(status().isOk());
    verify(products).update(ADMIN,ID,new AdminProductService.ProductRequest("Test product",ID,new BigDecimal("1200.50"),4,true,7L,"Description"));
    mvc.perform(delete(BASE+"/products/"+ID+"?version=7").header("Authorization","Bearer test-token")).andExpect(status().isNoContent());
    verify(products).delete(ADMIN,ID,7L);
  }
  @Test void categoryWritesReachExistingService() throws Exception {
    token("ADMIN");
    mvc.perform(post(BASE+"/categories").header("Authorization","Bearer test-token").contentType("application/json").content("{\"name\":\"Accessories\"}"))
        .andExpect(status().isCreated());
    verify(categories).create(ADMIN,new AdminCategoryService.CategoryRequest("Accessories"));
    mvc.perform(delete(BASE+"/categories/"+ID).header("Authorization","Bearer test-token")).andExpect(status().isNoContent());
    verify(categories).delete(ADMIN,ID);
  }
  @Test void userAccessUpdatesRequireVersionAndRiderResetUsesDedicatedService() throws Exception {
    token("ADMIN");
    mvc.perform(patch(BASE+"/users/"+RIDER+"/enabled").header("Authorization","Bearer test-token").contentType("application/json").content("{\"enabled\":false,\"version\":3}"))
        .andExpect(status().isOk());verify(users).updateEnabled(ADMIN,RIDER,new AdminUserService.EnabledRequest(false,3L));
    mvc.perform(patch(BASE+"/users/"+RIDER+"/password").header("Authorization","Bearer test-token").contentType("application/json").content("{\"newPassword\":\"Test-only-new-password\"}"))
        .andExpect(status().isNoContent());verify(passwords).resetRider(ADMIN,RIDER,new PasswordService.ResetPasswordRequest("Test-only-new-password"));
  }
  @Test void warehouseActionsPreserveTheAttemptAndSelectedRider() throws Exception {
    token("ADMIN");
    mvc.perform(get(BASE+"/deliveries/"+ID+"/warehouse").header("Authorization","Bearer test-token")).andExpect(status().isOk());verify(warehouse).get(ADMIN,ID);
    mvc.perform(patch(BASE+"/deliveries/"+ID+"/warehouse-receipt").header("Authorization","Bearer test-token").contentType("application/json").content("{\"attemptId\":\""+ID+"\"}"))
        .andExpect(status().isNoContent());verify(warehouse).confirmReceipt(ADMIN,ID,new WarehouseService.AttemptRequest(ID));
    mvc.perform(post(BASE+"/deliveries/"+ID+"/resolution").header("Authorization","Bearer test-token").contentType("application/json").content("{\"attemptId\":\""+ID+"\",\"action\":\"RETRY\",\"riderId\":\""+RIDER+"\"}"))
        .andExpect(status().isNoContent());verify(warehouse).resolve(ADMIN,ID,new WarehouseService.ResolutionRequest(ID,"RETRY",RIDER));
  }
  @Test void returnsRefundsReviewsAndCashUseExistingServices() throws Exception {
    token("ADMIN");
    mvc.perform(patch(BASE+"/returns/"+ID+"/status").header("Authorization","Bearer test-token").contentType("application/json").content("{\"status\":\"RECEIVED\"}"))
        .andExpect(status().isNoContent());verify(returns).updateStatus(ADMIN,ID,new AdminReturnService.StatusRequest("RECEIVED"));
    mvc.perform(post(BASE+"/returns/"+ID+"/refund").header("Authorization","Bearer test-token").contentType("application/json").content("{\"reference\":\"TEST-RECEIPT\"}"))
        .andExpect(status().isNoContent());verify(refunds).record(ADMIN,ID,new AdminRefundService.RefundRequest("TEST-RECEIPT"));
    mvc.perform(patch(BASE+"/reviews/"+ID+"/visibility").header("Authorization","Bearer test-token").contentType("application/json").content("{\"visible\":false}"))
        .andExpect(status().isNoContent());verify(reviews).updateVisibility(ADMIN,ID,new AdminReviewService.VisibilityRequest(false));
    mvc.perform(patch(BASE+"/cod/handovers/"+ID).header("Authorization","Bearer test-token").contentType("application/json").content("{\"status\":\"CONFIRMED\",\"note\":\"Counted\"}"))
        .andExpect(status().isNoContent());verify(cash).decide(ADMIN,ID,new RiderCodService.DecisionRequest("CONFIRMED","Counted"));
  }
  @Test void malformedFinancialRequestsNeverReachServices() throws Exception {
    token("ADMIN");
    mvc.perform(post(BASE+"/returns/"+ID+"/refund").header("Authorization","Bearer test-token").contentType("application/json").content("{\"reference\":\"\"}"))
        .andExpect(status().isBadRequest());
    mvc.perform(patch(BASE+"/cod/handovers/"+ID).header("Authorization","Bearer test-token").contentType("application/json").content("{\"status\":\"PAID\"}"))
        .andExpect(status().isBadRequest());
    mvc.perform(post(BASE+"/deliveries/"+ID+"/resolution").header("Authorization","Bearer test-token").contentType("application/json").content("{\"attemptId\":\""+ID+"\",\"action\":\"DELIVERED\"}"))
        .andExpect(status().isBadRequest());verifyNoInteractions(refunds,cash,warehouse);
  }
  @Test void productImagesSupportAuthenticatedMultipartAndPrimarySelection() throws Exception {
    token("ADMIN");when(images.upload(eq(ADMIN),eq(ID),anyList())).thenReturn(List.of());
    var file=new MockMultipartFile("files","test.jpg","image/jpeg",new byte[]{1,2,3});
    mvc.perform(multipart(BASE+"/products/"+ID+"/images").file(file).header("Authorization","Bearer test-token"))
        .andExpect(status().isCreated());verify(images).upload(eq(ADMIN),eq(ID),argThat(files->files.size()==1&&files.get(0).getOriginalFilename().equals("test.jpg")));
    mvc.perform(patch(BASE+"/products/"+ID+"/images/"+ID+"/primary").header("Authorization","Bearer test-token"))
        .andExpect(status().isOk());verify(images).makePrimary(ADMIN,ID,ID);
  }
  @Test void mobileAliasesDoNotRemoveWebCookieCsrfProtection() throws Exception {
    mvc.perform(post("/api/admin/categories").contentType("application/json").content("{\"name\":\"Test\"}"))
        .andExpect(status().isForbidden());verifyNoInteractions(categories);
  }
}
