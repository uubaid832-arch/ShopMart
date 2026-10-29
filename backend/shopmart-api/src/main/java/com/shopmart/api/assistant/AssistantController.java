package com.shopmart.api.assistant;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping({"/api/assistant", "/api/mobile/assistant"})
public class AssistantController {
  private final AssistantService service;

  public AssistantController(AssistantService service) {
    this.service = service;
  }

  @PostMapping("/chat")
  public ChatResponse chat(@Valid @RequestBody ChatRequest request) {
    return new ChatResponse(service.reply(request.language(), request.messages()));
  }

  public record ChatRequest(
      @NotBlank @Size(max = 2) String language,
      @NotEmpty @Size(max = 20) List<@Valid ChatMessage> messages) {}

  public record ChatMessage(
      @NotBlank @Size(max = 10) String role,
      @NotBlank @Size(max = 1000) String content) {}

  public record ChatResponse(String reply) {}
}
