package com.shopmart.api.addresses;

import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import static com.shopmart.api.addresses.AddressModels.*;

@RestController
@RequestMapping({ "/api/addresses", "/api/mobile/addresses" })
public class AddressController {

  private final AddressService addresses;

  public AddressController(AddressService addresses) {
    this.addresses = addresses;
  }

  @GetMapping
  public List<AddressResponse> list(@AuthenticationPrincipal Jwt jwt) {
    return addresses.list(UUID.fromString(jwt.getSubject()));
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public AddressResponse create(
      @AuthenticationPrincipal Jwt jwt,
      @Valid @RequestBody AddressRequest request) {
    return addresses.create(UUID.fromString(jwt.getSubject()), request);
  }

  @PutMapping("/{id}")
  public AddressResponse update(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID id,
      @Valid @RequestBody AddressRequest request) {
    return addresses.update(UUID.fromString(jwt.getSubject()), id, request);
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID id) {
    addresses.delete(UUID.fromString(jwt.getSubject()), id);
  }
}