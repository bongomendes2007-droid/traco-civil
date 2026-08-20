# ---- Build stage ----
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -B dependency:go-offline
COPY src ./src
RUN mvn -B -DskipTests package

# ---- Runtime stage (imagem mínima + usuário non-root) ----
FROM eclipse-temurin:21-jre
RUN useradd --system --uid 10001 traco
WORKDIR /app
COPY --from=build /app/target/traco-api-0.1.0.jar app.jar
RUN mkdir -p /app/data /app/uploads && chown -R traco:traco /app
USER traco
EXPOSE 8000
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]