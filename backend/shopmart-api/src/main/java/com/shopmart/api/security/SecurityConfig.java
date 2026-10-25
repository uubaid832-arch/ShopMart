package com.shopmart.api.security;

import jakarta.servlet.DispatcherType;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;

@Configuration
public class SecurityConfig {

        @Bean
        public PasswordEncoder passwordEncoder() {
                return new BCryptPasswordEncoder(12);
        }

        @Bean
        public JwtAuthenticationConverter jwtAuthenticationConverter() {
                JwtGrantedAuthoritiesConverter authorities = new JwtGrantedAuthoritiesConverter();

                authorities.setAuthoritiesClaimName("roles");
                authorities.setAuthorityPrefix("ROLE_");

                JwtAuthenticationConverter converter = new JwtAuthenticationConverter();

                converter.setJwtGrantedAuthoritiesConverter(authorities);
                return converter;
        }

        @Bean
        public SecurityFilterChain securityFilterChain(
                        HttpSecurity http,
                        JwtAuthenticationConverter jwtAuthenticationConverter,
                        @Value("${shopmart.auth.cookie-secure:false}") boolean secureCookies) throws Exception {

                CookieCsrfTokenRepository csrfRepository = new CookieCsrfTokenRepository();

                csrfRepository.setCookieCustomizer(cookie -> cookie
                                .httpOnly(true)
                                .secure(secureCookies)
                                .sameSite("Strict")
                                .path("/"));

                http
                                .csrf(csrf -> csrf
                                                .csrfTokenRepository(csrfRepository))
                                .authorizeHttpRequests(authorize -> authorize
                                                .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
                                                .requestMatchers(HttpMethod.GET,
                                                                "/", "/index.html", "/assets/**",
                                                                "/favicon.svg", "/icons.svg", "/favicon.ico", "/robots.txt",
                                                                "/admin", "/admin/**", "/rider", "/rider/**")
                                                .permitAll()
                                                .requestMatchers(
                                                                HttpMethod.GET,
                                                                "/api/health",
                                                                "/api/categories",
                                                                "/api/products",
                                                                "/api/products/*",
                                                                "/api/auth/csrf")
                                                .permitAll()
                                                .requestMatchers(
                                                                HttpMethod.POST,
                                                                "/api/auth/register",
                                                                "/api/auth/login",
                                                                "/api/auth/login/verify",
                                                                "/api/auth/login/resend",
                                                                "/api/auth/password/forgot",
                                                                "/api/auth/password/resend",
                                                                "/api/auth/password/reset",
                                                                "/api/auth/refresh",
                                                                "/api/auth/logout")
                                                .permitAll()
                                                .requestMatchers(
                                                                HttpMethod.GET,
                                                                "/api/auth/me")
                                                .authenticated()
                                                .requestMatchers(
                                                                HttpMethod.POST,
                                                                "/api/orders",
                                                                "/api/checkout/process-payment")
                                                .authenticated()
                                                .requestMatchers(
                                                                HttpMethod.GET,
                                                                "/api/orders",
                                                                "/api/orders/*")
                                                .authenticated()
                                                .requestMatchers(HttpMethod.PATCH, "/api/auth/me")
                                                .authenticated()
                                                .requestMatchers(HttpMethod.GET, "/api/addresses")
                                                .authenticated()
                                                .requestMatchers(HttpMethod.POST, "/api/addresses")
                                                .authenticated()
                                                .requestMatchers(HttpMethod.PUT, "/api/addresses/*")
                                                .authenticated()
                                                .requestMatchers(HttpMethod.DELETE, "/api/addresses/*")
                                                .authenticated()
                                                .requestMatchers(
                                                                HttpMethod.GET,
                                                                "/api/admin/orders",
                                                                "/api/admin/orders/*")
                                                .hasRole("ADMIN")
                                                .requestMatchers(
                                                                HttpMethod.PATCH,
                                                                "/api/admin/orders/*/status")
                                                .hasRole("ADMIN")
                                                .requestMatchers(
                                                                HttpMethod.GET,
                                                                "/api/orders/*/tracking")
                                                .authenticated()
                                                .requestMatchers(
                                                                HttpMethod.GET,
                                                                "/api/admin/dashboard")
                                                .hasRole("ADMIN")
                                                .requestMatchers(HttpMethod.GET, "/api/admin/products")
                                                .hasRole("ADMIN")
                                                .requestMatchers(HttpMethod.POST, "/api/admin/products")
                                                .hasRole("ADMIN")
                                                .requestMatchers(HttpMethod.PUT, "/api/admin/products/*")
                                                .hasRole("ADMIN")
                                                .requestMatchers(HttpMethod.POST, "/api/admin/categories")
                                                .hasRole("ADMIN")
                                                .requestMatchers(HttpMethod.PUT, "/api/admin/categories/*")
                                                .hasRole("ADMIN")
                                                .requestMatchers(
                                                                HttpMethod.GET,
                                                                "/api/admin/deliveries",
                                                                "/api/admin/deliveries/riders")
                                                .hasRole("ADMIN")
                                                .requestMatchers(
                                                                HttpMethod.PUT,
                                                                "/api/admin/deliveries/*/assignment")
                                                .hasRole("ADMIN")
                                                .requestMatchers(
                                                                HttpMethod.GET,
                                                                "/api/rider/deliveries")
                                                .hasRole("RIDER")
                                                .requestMatchers(
                                                                HttpMethod.PATCH,
                                                                "/api/rider/deliveries/*/complete",
                                                                "/api/rider/deliveries/*/failed")
                                                .hasRole("RIDER")
                                                .requestMatchers(
                                                                HttpMethod.GET,
                                                                "/api/returns",
                                                                "/api/returns/eligible")
                                                .authenticated()
                                                .requestMatchers(HttpMethod.POST, "/api/returns")
                                                .authenticated()
                                                .requestMatchers(HttpMethod.GET, "/api/admin/returns")
                                                .hasRole("ADMIN")
                                                .requestMatchers(
                                                                HttpMethod.PATCH,
                                                                "/api/admin/returns/*/status")
                                                .hasRole("ADMIN")
                                                .requestMatchers(
                                                                HttpMethod.POST,
                                                                "/api/admin/returns/*/refund")
                                                .hasRole("ADMIN")
                                                .requestMatchers(HttpMethod.GET, "/api/notifications")
                                                .authenticated()
                                                .requestMatchers(
                                                                HttpMethod.PATCH,
                                                                "/api/notifications/*/read")
                                                .authenticated()
                                                .requestMatchers(
                                                                HttpMethod.PATCH,
                                                                "/api/notifications/read-all")
                                                .authenticated()
                                                .requestMatchers(
                                                                HttpMethod.GET,
                                                                "/api/products/*/reviews")
                                                .permitAll()
                                                .requestMatchers(
                                                                HttpMethod.GET,
                                                                "/api/products/*/reviews/eligibility")
                                                .authenticated()
                                                .requestMatchers(
                                                                HttpMethod.POST,
                                                                "/api/products/*/reviews")
                                                .authenticated()
                                                .requestMatchers(HttpMethod.GET, "/api/admin/reviews")
                                                .hasRole("ADMIN")
                                                .requestMatchers(
                                                                HttpMethod.PATCH,
                                                                "/api/admin/reviews/*/visibility")
                                                .hasRole("ADMIN")
                                                .requestMatchers(
                                                                HttpMethod.PATCH,
                                                                "/api/admin/deliveries/*/details")
                                                .hasRole("ADMIN")
                                                .requestMatchers(
                                                                HttpMethod.GET,
                                                                "/api/admin/deliveries/*/warehouse")
                                                .hasRole("ADMIN")
                                                .requestMatchers(
                                                                HttpMethod.PATCH,
                                                                "/api/admin/deliveries/*/warehouse-receipt")
                                                .hasRole("ADMIN")
                                                .requestMatchers(
                                                                HttpMethod.POST,
                                                                "/api/admin/deliveries/*/resolution")
                                                .hasRole("ADMIN")
                                                .requestMatchers(
                                                                HttpMethod.GET,
                                                                "/api/rider/deliveries/*/warehouse")
                                                .hasRole("RIDER")
                                                .requestMatchers(
                                                                HttpMethod.PATCH,
                                                                "/api/rider/deliveries/*/warehouse-return")
                                                .hasRole("RIDER")

                                                .requestMatchers(
                                                                HttpMethod.GET,
                                                                "/api/admin/deliveries/*/assignment")
                                                .hasRole("ADMIN")
                                                .requestMatchers(
                                                                HttpMethod.GET,
                                                                "/api/admin/products/*/images")
                                                .hasRole("ADMIN")
                                                .requestMatchers(
                                                                HttpMethod.POST,
                                                                "/api/admin/products/*/images")
                                                .hasRole("ADMIN")
                                                .requestMatchers(
                                                                HttpMethod.PATCH,
                                                                "/api/admin/products/*/images/*/primary")
                                                .hasRole("ADMIN")
                                                .requestMatchers(
                                                                HttpMethod.DELETE,
                                                                "/api/admin/products/*/images/*")
                                                .hasRole("ADMIN")
                                                .requestMatchers(
                                                                HttpMethod.GET,
                                                                "/api/product-images",
                                                                "/api/product-images/files/*")
                                                .permitAll()
                                                .requestMatchers(
                                                                HttpMethod.PUT,
                                                                "/api/rider/deliveries/*/location")
                                                .hasRole("RIDER")
                                                .requestMatchers(
                                                                HttpMethod.DELETE,
                                                                "/api/rider/deliveries/*/location")
                                                .hasRole("RIDER")
                                                .requestMatchers(
                                                                HttpMethod.GET,
                                                                "/api/orders/*/location")
                                                .authenticated()
                                                .requestMatchers(
                                                                HttpMethod.GET,
                                                                "/api/orders/*/invoice")
                                                .authenticated()
                                                .requestMatchers(
                                                                HttpMethod.GET,
                                                                "/api/admin/orders/*/invoice", "/api/admin/orders/*/history")
                                                .hasRole("ADMIN")
                                                .requestMatchers(
                                                                HttpMethod.DELETE,
                                                                "/api/admin/products/*",
                                                                "/api/admin/categories/*")
                                                .hasRole("ADMIN")
                                                .requestMatchers(
                                                                HttpMethod.GET,
                                                                "/api/admin/users")
                                                .hasRole("ADMIN")
                                                .requestMatchers(
                                                                HttpMethod.POST,
                                                                "/api/admin/users/riders")
                                                .hasRole("ADMIN")
                                                .requestMatchers(
                                                                HttpMethod.PATCH,
                                                                "/api/admin/users/*/enabled")
                                                .hasRole("ADMIN")
                                                .requestMatchers(
                                                                HttpMethod.PATCH,
                                                                "/api/auth/password")
                                                .authenticated()
                                                .requestMatchers(
                                                                HttpMethod.PATCH,
                                                                "/api/admin/users/*/password")
                                                .hasRole("ADMIN")
                                                .requestMatchers(HttpMethod.GET,
                                                                "/api/admin/cod/handovers",
                                                                "/api/admin/cod/handovers/*")
                                                .hasRole("ADMIN")
                                                .requestMatchers(HttpMethod.PATCH, "/api/admin/cod/handovers/*")
                                                .hasRole("ADMIN")
                                                .requestMatchers(HttpMethod.POST, "/api/vouchers/quote").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/admin/vouchers").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/admin/vouchers").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PATCH, "/api/admin/vouchers/*").hasRole("ADMIN")
                        .anyRequest().denyAll())
                                .sessionManagement(session -> session
                                                .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                                .oauth2ResourceServer(resourceServer -> resourceServer
                                                .jwt(jwt -> jwt
                                                                .jwtAuthenticationConverter(
                                                                                jwtAuthenticationConverter)))
                                .formLogin(form -> form.disable())
                                .httpBasic(basic -> basic.disable())
                                .exceptionHandling(exceptions -> exceptions
                                                .authenticationEntryPoint(
                                                                new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)));

                return http.build();
        }
}