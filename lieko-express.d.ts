declare namespace Lieko {
  type PlainObject = Record<string, any>;

  // Extract params from a path string like "/user/:id/books/:bookId"
  type ExtractRouteParams<Path extends string> =
    Path extends `${string}:${infer Param}/${infer Rest}`
    ? { [k in Param | keyof ExtractRouteParams<Rest>]: string }
    : Path extends `${string}:${infer Param}`
    ? { [k in Param]: string }
    : Record<string, never>;

  // -------------- Request / Response types --------------
  // Minimal subset of http.IncomingMessage / http.ServerResponse for typings
  interface RequestBase {
    method: string;
    url: string;
    headers: Record<string, string | undefined>;
    // populated by the framework:
    query: Record<string, any>;
    params: Record<string, any>;
    body: any;
    files: Record<string, any>;
    ip?: string;
    _bodySize?: number;
    _startTime?: bigint;
    // raw Node objects (optional)
    raw?: any;
  }

  interface ResponseBase {
    status(code: number): this;
    json(data: any): void;
    send(data: any): void;
    text(data: string): void;

    // headers helpers
    setHeader(name: string, value: string | number): void;
    getHeader(name: string): string | number | string[] | undefined;
    removeHeader(name: string): void;
    headersSent?: boolean;

    // redirect helpers
    redirect(url: string): void;
    redirect(status: number, url: string): void;

    // streaming (optional)
    write?(chunk: any): void;
    end?(chunk?: any): void;
  }

  // Extended Lieko Request and Response with framework helpers
  interface Request<
    Params extends Record<string, any> = Record<string, any>,
    Query extends Record<string, any> = Record<string, any>,
    Body = any
  > extends RequestBase {
    params: Params;
    query: Query;
    body: Body;
    files: Record<string, {
      filename: string;
      tempFilePath?: string;
      data?: Buffer;
      contentType?: string;
      size?: number;
    }>;
  }

  interface Response extends ResponseBase {
    // Rich helpers provided by Lieko
    ok(data?: any, message?: string): void;
    created(data?: any, message?: string): void;
    accepted(data?: any, message?: string): void;
    noContent(): void;

    badRequest(message?: string, details?: any): void;
    unauthorized(message?: string, details?: any): void;
    forbidden(message?: string, details?: any): void;
    notFound(message?: string, details?: any): void;
    error(message?: string, status?: number, details?: any): void;

    // convenience helpers sometimes provided
    paginated?(items: any[], meta: any): void;
    file?(pathOrBuffer: string | Buffer, filename?: string): void;
    download?(path: string, filename?: string): void;

    // short alias
    statusCode?: number;
  }

  // -------------- Handler / Middleware --------------
  type Handler<
    Params extends Record<string, any> = Record<string, any>,
    Query extends Record<string, any> = Record<string, any>,
    Body = any
  > = (req: Request<Params, Query, Body>, res: Response, next?: (err?: any) => void) => any | Promise<any>;

  // -------------- CORS / BodyParser options --------------
  interface CorsOptions {
    enabled?: boolean;
    origin?: "*" | string | string[]; // supports wildcard like https://*.example.com
    methods?: string[]; // allowed methods
    headers?: string[]; // allowed headers
    exposedHeaders?: string[];
    credentials?: boolean;
    maxAge?: number;
    debug?: boolean;
    strictOrigin?: boolean; // 403 if origin not allowed
    allowPrivateNetwork?: boolean; // Access-Control-Allow-Private-Network
  }

  interface JsonBodyOptions {
    limit?: string; // e.g. "10mb"
    strict?: boolean;
  }

  interface UrlencodedOptions {
    limit?: string;
    extended?: boolean;
  }

  interface MultipartOptions {
    limit?: string;
    tempDir?: string;
  }

  interface BodyParserOptions {
    json?: JsonBodyOptions;
    urlencoded?: UrlencodedOptions;
    multipart?: MultipartOptions;
  }

  // -------------- Validation / Schema (loose typing to match runtime) --------------
  // The framework has a validation system — keep it flexible (user can extend)
  type ValidatorFn = (value: any) => boolean | string | Promise<boolean | string>;

  interface SchemaField {
    type?: string | string[]; // "string", "number", etc.
    required?: boolean;
    validators?: ValidatorFn[];
    default?: any;
    // additional user metadata allowed
    [key: string]: any;
  }

  interface SchemaDefinition {
    [field: string]: SchemaField | string; // string shorthand for type
  }

  interface Schema {
    definition: SchemaDefinition;
    validate(obj: any, options?: { partial?: boolean }): { valid: boolean; errors?: any };
  }

  // -------------- Routes / Options --------------
  interface RouteOptions {
    cors?: Partial<CorsOptions>;
    bodyParserOptions?: Partial<BodyParserOptions>;
    middlewares?: Handler[];
    // validation
    schema?: Schema | SchemaDefinition;
    // other custom per-route options
    [key: string]: any;
  }

  // -------------- App interface --------------
  interface App {
    // route methods (typed path param extraction)
    get<Path extends string, Q = any, B = any>(
      path: Path,
      optionsOrHandler?: RouteOptions | Handler<ExtractRouteParams<Path>, Q, B>,
      maybeHandler?: Handler<ExtractRouteParams<Path>, Q, B>
    ): this;

    post<Path extends string, Q = any, B = any>(
      path: Path,
      optionsOrHandler?: RouteOptions | Handler<ExtractRouteParams<Path>, Q, B>,
      maybeHandler?: Handler<ExtractRouteParams<Path>, Q, B>
    ): this;

    put<Path extends string, Q = any, B = any>(
      path: Path,
      optionsOrHandler?: RouteOptions | Handler<ExtractRouteParams<Path>, Q, B>,
      maybeHandler?: Handler<ExtractRouteParams<Path>, Q, B>
    ): this;

    patch<Path extends string, Q = any, B = any>(
      path: Path,
      optionsOrHandler?: RouteOptions | Handler<ExtractRouteParams<Path>, Q, B>,
      maybeHandler?: Handler<ExtractRouteParams<Path>, Q, B>
    ): this;

    delete<Path extends string, Q = any, B = any>(
      path: Path,
      optionsOrHandler?: RouteOptions | Handler<ExtractRouteParams<Path>, Q, B>,
      maybeHandler?: Handler<ExtractRouteParams<Path>, Q, B>
    ): this;

    options<Path extends string, Q = any, B = any>(
      path: Path,
      optionsOrHandler?: RouteOptions | Handler<ExtractRouteParams<Path>, Q, B>,
      maybeHandler?: Handler<ExtractRouteParams<Path>, Q, B>
    ): this;

    head<Path extends string, Q = any, B = any>(
      path: Path,
      optionsOrHandler?: RouteOptions | Handler<ExtractRouteParams<Path>, Q, B>,
      maybeHandler?: Handler<ExtractRouteParams<Path>, Q, B>
    ): this;

    // manual route API
    route(method: string, path: string, options: RouteOptions, handler: Handler): this;

    // middleware
    use(handler: Handler): this;
    use(path: string, handler: Handler): this;

    // grouping
    group(prefix: string, cb: (router: App) => void): this;

    // CORS
    cors(options?: Partial<CorsOptions>): this;

    // body parser options at app-level
    bodyParser(options: Partial<BodyParserOptions>): this;

    // validation / schema helpers
    schema(name: string, definition: SchemaDefinition | Schema): Schema;
    validate(schemaOrDef: string | Schema | SchemaDefinition): Handler;

    // error / notFound handlers
    notFound(handler: Handler): this;
    error(handler: (err: any, req: Request, res: Response) => any): this;

    // utilities
    printRoutes(): void;
    close(): Promise<void> | void;

    // server control
    listen(port: number, callback?: () => void): any;
    listen(port: number, host: string, callback?: () => void): any;
  }

  // -------------- Factory / Constructor --------------
  interface ConstructorOptions {
    // initial options
    cors?: Partial<CorsOptions>;
    bodyParser?: Partial<BodyParserOptions>;
    trustProxy?: boolean | string | string[];
    // other global options
    [key: string]: any;
  }

  interface LiekoStatic {
    (opts?: ConstructorOptions): App;

    // expose helpers statically if present in runtime
    createApp(opts?: ConstructorOptions): App;
  }
}

// Export as CommonJS-compatible factory function
declare const Lieko: Lieko.LiekoStatic;
export = Lieko;
