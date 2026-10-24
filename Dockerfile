# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS web-build
WORKDIR /build/web
COPY apps/web/package.json apps/web/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY apps/web/ ./
RUN npm run build

FROM maven:3.9.11-eclipse-temurin-17 AS api-build
WORKDIR /build/api
COPY backend/shopmart-api/pom.xml ./
COPY backend/shopmart-api/src/ ./src/
COPY --from=web-build /build/web/dist/ ./src/main/resources/static/
# Integration tests need a separate database; do not execute them during deployment builds.
RUN --mount=type=cache,target=/root/.m2 mvn -B -DskipTests package

FROM eclipse-temurin:17-jre-jammy AS runtime
WORKDIR /app
COPY --from=api-build --chown=10001:10001 /build/api/target/*.jar /app/app.jar
ENV SPRING_PROFILES_ACTIVE=production
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=55.0 -XX:InitialRAMPercentage=20.0 -XX:+ExitOnOutOfMemoryError -Djava.awt.headless=true"
USER 10001:10001
EXPOSE 10000
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
