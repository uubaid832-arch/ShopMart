package com.shopmart.api.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;

@Configuration
public class MobileApiSecurityConfig {

    @Bean
    @Order(2)
    public SecurityFilterChain mobileApiSecurityFilterChain(
            HttpSecurity http,
            JwtAuthenticationConverter jwtAuthenticationConverter) throws Exception {
        http
                .securityMatcher("/api/mobile/**")
                // Mobile APIs authenticate using bearer tokens, not cookies.
                .csrf(csrf -> csrf.disable())
                .authorizeHttpRequests(authorize -> authorize
                        .requestMatchers(HttpMethod.POST, "/api/mobile/orders")
                        .authenticated()
                        .requestMatchers(
                                HttpMethod.GET,
                                "/api/mobile/orders",
                                "/api/mobile/orders/*",
                                "/api/mobile/orders/*/tracking")
                        .authenticated()
                        .requestMatchers(
                                HttpMethod.GET,
                                "/api/mobile/notifications")
                        .authenticated()
                        .requestMatchers(
                                HttpMethod.PATCH,
                                "/api/mobile/notifications/*/read",
                                "/api/mobile/notifications/read-all")
                        .authenticated()
                        .requestMatchers(
                                HttpMethod.GET,
                                "/api/mobile/products/*/reviews")
                        .permitAll()
                        .requestMatchers(
                                HttpMethod.GET,
                                "/api/mobile/products/*/reviews/eligibility")
                        .authenticated()
                        .requestMatchers(
                                HttpMethod.POST,
                                "/api/mobile/products/*/reviews")
                        .authenticated()
                        .requestMatchers(
                                HttpMethod.GET,
                                "/api/mobile/returns",
                                "/api/mobile/returns/eligible")
                        .authenticated()
                        .requestMatchers(
                                HttpMethod.POST,
                                "/api/mobile/returns")
                        .authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/mobile/addresses")
                        .authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/mobile/addresses")
                        .authenticated()
                        .requestMatchers(HttpMethod.PUT, "/api/mobile/addresses/*")
                        .authenticated()
                        .requestMatchers(HttpMethod.DELETE, "/api/mobile/addresses/*")
                        .authenticated()
                        .requestMatchers(
                                HttpMethod.GET,
                                "/api/mobile/orders/*/location")
                        .authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/mobile/profile")
                        .authenticated()
                        .requestMatchers(HttpMethod.PATCH, "/api/mobile/profile")
                        .authenticated()
                        .requestMatchers(
                                HttpMethod.PATCH,
                                "/api/mobile/profile/password")
                        .authenticated()
                        .requestMatchers(
                                HttpMethod.GET,
                                "/api/mobile/rider/deliveries")
                        .hasRole("RIDER")
                        .requestMatchers(
                                HttpMethod.PATCH,
                                "/api/mobile/rider/deliveries/*/complete",
                                "/api/mobile/rider/deliveries/*/failed")
                        .hasRole("RIDER")
                        .requestMatchers(
                                HttpMethod.PUT,
                                "/api/mobile/rider/deliveries/*/location")
                        .hasRole("RIDER")
                        .requestMatchers(
                                HttpMethod.DELETE,
                                "/api/mobile/rider/deliveries/*/location")
                        .hasRole("RIDER")
                        .requestMatchers(HttpMethod.GET,
                                "/api/mobile/rider/deliveries/*/warehouse")
                        .hasRole("RIDER")
                        .requestMatchers(HttpMethod.PATCH,
                                "/api/mobile/rider/deliveries/*/warehouse-return")
                        .hasRole("RIDER")
                        .requestMatchers(HttpMethod.GET,
                                "/api/mobile/rider/dashboard",
                                "/api/mobile/rider/cod/collections",
                                "/api/mobile/rider/cod/handovers",
                                "/api/mobile/rider/cod/handovers/*")
                        .hasRole("RIDER")
                        .requestMatchers(HttpMethod.POST, "/api/mobile/rider/cod/handovers")
                        .hasRole("RIDER")
                        .requestMatchers(HttpMethod.GET,
                                "/api/mobile/admin/cod/handovers",
                                "/api/mobile/admin/cod/handovers/*")
                        .hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PATCH, "/api/mobile/admin/cod/handovers/*")
                        .hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET,
                                "/api/mobile/admin/dashboard",
                                "/api/mobile/admin/orders",
                                "/api/mobile/admin/orders/*",
                                "/api/mobile/admin/orders/*/history",
                                "/api/mobile/admin/orders/*/invoice",
                                "/api/mobile/admin/deliveries/riders",
                                "/api/mobile/admin/deliveries/*/assignment")
                        .hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PATCH, "/api/mobile/admin/orders/*/status")
                        .hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/mobile/admin/deliveries/*/assignment")
                        .hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET,
                                "/api/mobile/admin/products",
                                "/api/mobile/admin/products/*/images",
                                "/api/mobile/admin/users",
                                "/api/mobile/admin/deliveries",
                                "/api/mobile/admin/deliveries/*/warehouse",
                                "/api/mobile/admin/returns",
                                "/api/mobile/admin/reviews")
                        .hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST,
                                "/api/mobile/admin/products",
                                "/api/mobile/admin/products/*/images",
                                "/api/mobile/admin/categories",
                                "/api/mobile/admin/users/riders",
                                "/api/mobile/admin/deliveries/*/resolution",
                                "/api/mobile/admin/returns/*/refund")
                        .hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT,
                                "/api/mobile/admin/products/*",
                                "/api/mobile/admin/categories/*")
                        .hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PATCH,
                                "/api/mobile/admin/products/*/images/*/primary",
                                "/api/mobile/admin/users/*/enabled",
                                "/api/mobile/admin/users/*/password",
                                "/api/mobile/admin/deliveries/*/details",
                                "/api/mobile/admin/deliveries/*/warehouse-receipt",
                                "/api/mobile/admin/returns/*/status",
                                "/api/mobile/admin/reviews/*/visibility")
                        .hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE,
                                "/api/mobile/admin/products/*",
                                "/api/mobile/admin/products/*/images/*",
                                "/api/mobile/admin/categories/*")
                        .hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/mobile/vouchers/quote").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/mobile/admin/vouchers").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/mobile/admin/vouchers").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PATCH, "/api/mobile/admin/vouchers/*").hasRole("ADMIN")
                        .anyRequest().denyAll())
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .oauth2ResourceServer(resourceServer -> resourceServer
                        .jwt(jwt -> jwt
                                .jwtAuthenticationConverter(jwtAuthenticationConverter)))
                .formLogin(form -> form.disable())
                .httpBasic(basic -> basic.disable())
                .logout(logout -> logout.disable())
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint(
                                new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)));

        return http.build();
    }
}