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