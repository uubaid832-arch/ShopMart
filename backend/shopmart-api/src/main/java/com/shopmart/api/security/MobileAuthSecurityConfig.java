package com.shopmart.api.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;

@Configuration
public class MobileAuthSecurityConfig {

  @Bean
  @Order(1)
  public SecurityFilterChain mobileAuthSecurityFilterChain(
      HttpSecurity http) throws Exception {
    http
        .securityMatcher("/api/mobile/auth/**")
        // These endpoints use credentials or refresh tokens from JSON.
        // They do not authenticate through browser cookies.
        .csrf(csrf -> csrf.disable())
        .authorizeHttpRequests(authorize -> authorize
            .requestMatchers(
                HttpMethod.POST,
                "/api/mobile/auth/register",
                "/api/mobile/auth/login",
                "/api/mobile/auth/login/verify",
                "/api/mobile/auth/login/resend",
                "/api/mobile/auth/password/forgot",
                "/api/mobile/auth/password/resend",
                "/api/mobile/auth/password/reset",
                "/api/mobile/auth/refresh",
                "/api/mobile/auth/logout")
            .permitAll()
            .anyRequest().denyAll())
        .sessionManagement(session -> session
            .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .formLogin(form -> form.disable())
        .httpBasic(basic -> basic.disable())
        .logout(logout -> logout.disable())
        .exceptionHandling(exceptions -> exceptions
            .authenticationEntryPoint(
                new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)));

    return http.build();
  }
}