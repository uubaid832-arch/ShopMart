package com.shopmart.api.addresses;

import java.util.UUID;
import jakarta.validation.constraints.*;

public final class AddressModels {

  private AddressModels() {
  }

  public record AddressRequest(
      @NotBlank @Size(max = 100) String label,
      @NotBlank @Size(max = 100) String recipientName,
      @NotBlank @Size(max = 32) String phone,
      @NotBlank @Size(max = 250) String addressLine,
      @NotBlank @Size(max = 100) String city,
      @Size(max = 20) String postalCode,
      @NotBlank @Pattern(regexp = "Pakistan") String country,
      @NotNull Boolean isDefault) {
  }

  public record AddressResponse(
      UUID id,
      String label,
      String recipientName,
      String phone,
      String addressLine,
      String city,
      String postalCode,
      String country,
      boolean isDefault) {
  }
}