# Backend Agent Instructions

These instructions apply when working under `backend/`. They add to the
repository-wide guidance in the root `AGENTS.md`.

## Backend Rules

- Use NestJS constructor injection; never use property injection.
- Every new module must be registered in its parent module's `imports` array,
  including `AppModule` when appropriate.
- Controllers must delegate to services. Do not put business logic or database
  queries in controllers.
- Every I/O method for database, HTTP, or filesystem work must be async and
  return a typed `Promise<T>`.
- Use DTO classes for request bodies. Decorate fields with `class-validator`;
  use `@Type()` for nested values or dates and `@Transform()` for coercion such
  as trimming.
- Use standard NestJS `HttpException` classes, or custom exceptions extending
  them. Do not throw generic `Error` objects from controllers or services.
- Use NestJS `Logger` or the application's logger instead of `console.log`,
  `console.warn`, or `console.error`.
- Prefer a private instance logger such as
  `private readonly logger = new Logger(ClassName.name)`.
- Wrap multiple related database writes in a TypeORM `DataSource` or
  `QueryRunner` transaction.
- Keep the global `ValidationPipe` in `main.ts` configured with
  `whitelist: true`, `forbidNonWhitelisted: true`, and `transform: true`.
- Schema synchronization is intentional for the MVP (`synchronize: true` in
  development). Do not introduce migrations until the schema is intentionally
  stabilized.
- Decorate every controller with `@ApiTags('resource-name')`.
- Decorate every endpoint with `@ApiOperation()` and an appropriate typed
  `@ApiOkResponse()` or `@ApiCreatedResponse()`.

The backend Swagger UI is available at `/api/docs` when the backend is running.

## Structure And Naming

Use strict kebab-case filenames:

```text
src/
  common/    decorators, filters, guards, interceptors, pipes, interfaces
  config/    configuration and validation schemas
  modules/   feature modules, each in its own directory
  shared/    services and constants reused across modules
```

Use the appropriate suffixes: `*.controller.ts`, `*.service.ts`,
`*.module.ts`, `*.dto.ts`, `*.entity.ts`, `*.guard.ts`, `*.interceptor.ts`,
`*.pipe.ts`, `*.filter.ts`, and `*.interface.ts`.

When creating a module, account for the entity, DTOs, service, controller,
tests, and parent-module registration together. Do not stop after creating a
single file.

## Testing

- Co-locate unit tests next to the file under test.
- Use Jest and mock external dependencies, especially TypeORM repositories and
  custom providers.
- Use Supertest for E2E tests with a dedicated test database environment.
- Add a basic `.spec.ts` for every new service, controller, or guard.

Run backend commands with:

```text
npm --prefix backend run <script>
```
