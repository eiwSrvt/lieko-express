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
    set(name: string | Record<string, string | number>, value?: string | number): void;
    header(name: string, value: string | number): void;
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
    success: (data?: any, message?: string) => void;
    created(data?: any, message?: string): void;
    noContent(): void;
    accepted(data?: any, message?: string): void;

    badRequest(message?: string, details?: any): void;
    unauthorized(message?: string, details?: any): void;
    forbidden(message?: string, details?: any): void;
    notFound(message?: string, details?: any): void;
    error(message?: string, status?: number, details?: any): void;
    fail: (message?: string, status?: number, details?: any) => void;
    serverError(message?: string, details?: any): void;

    // convenience helpers sometimes provided
    paginated?(items: any[], total: number, message?: string): void;
    html?(html: string, status?: number): void;

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
  type ValidatorFn = (value: any, field: string, data: any) => { field: string; message: string; type: string } | null;

  interface Validators {
    required(message?: string): ValidatorFn;
    requiredTrue(message?: string): ValidatorFn;
    optional(): ValidatorFn;
    string(message?: string): ValidatorFn;
    number(message?: string): ValidatorFn;
    boolean(message?: string): ValidatorFn;
    integer(message?: string): ValidatorFn;
    positive(message?: string): ValidatorFn;
    negative(message?: string): ValidatorFn;
    email(message?: string): ValidatorFn;
    min(minValue: number, message?: string): ValidatorFn;
    max(maxValue: number, message?: string): ValidatorFn;
    length(n: number, message?: string): ValidatorFn;
    minLength(minLength: number, message?: string): ValidatorFn;
    maxLength(maxLength: number, message?: string): ValidatorFn;
    pattern(regex: RegExp, message?: string): ValidatorFn;
    oneOf(allowedValues: any[], message?: string): ValidatorFn;
    notOneOf(values: any[], message?: string): ValidatorFn;
    custom(validatorFn: (value: any, data: any) => boolean, message?: string): ValidatorFn;
    equal(expectedValue: any, message?: string): ValidatorFn;
    mustBeTrue(message?: string): ValidatorFn;
    mustBeFalse(message?: string): ValidatorFn;
    date(message?: string): ValidatorFn;
    before(limit: string | Date, message?: string): ValidatorFn;
    after(limit: string | Date, message?: string): ValidatorFn;
    startsWith(prefix: string, message?: string): ValidatorFn;
    endsWith(suffix: string, message?: string): ValidatorFn;
  }

  class Schema {
    constructor(rules: Record<string, ValidatorFn[]>);
    rules: Record<string, ValidatorFn[]>;
    fields: Record<string, ValidatorFn[]>;
    validate(data: Record<string, any>): true | never;
  }

  function validate(schema: Schema): Handler;

  function validatePartial(schema: Schema): Handler;

  // -------------- Routes / Options --------------
  interface Route {
    method: string;
    path: string;
    handler: Handler;
    middlewares: Handler[];
    pattern: RegExp;
    groupChain: any[];
  }

  // -------------- App interface --------------
  interface App {
    // route methods (typed path param extraction)
    get<Path extends string, Q = any, B = any>(
      path: Path,
      ...handlers: Handler<ExtractRouteParams<Path>, Q, B>[]
    ): this;

    post<Path extends string, Q = any, B = any>(
      path: Path,
      ...handlers: Handler<ExtractRouteParams<Path>, Q, B>[]
    ): this;

    put<Path extends string, Q = any, B = any>(
      path: Path,
      ...handlers: Handler<ExtractRouteParams<Path>, Q, B>[]
    ): this;

    patch<Path extends string, Q = any, B = any>(
      path: Path,
      ...handlers: Handler<ExtractRouteParams<Path>, Q, B>[]
    ): this;

    delete<Path extends string, Q = any, B = any>(
      path: Path,
      ...handlers: Handler<ExtractRouteParams<Path>, Q, B>[]
    ): this;

    all<Path extends string, Q = any, B = any>(
      path: Path,
      ...handlers: Handler<ExtractRouteParams<Path>, Q, B>[]
    ): this;

    // middleware
    use(handler: Handler | App): this;
    use(path: string, handler: Handler | App): this;

    // grouping
    group(basePath: string, callback: (group: App) => void): this;

    // CORS
    cors(options?: Partial<CorsOptions>): Handler;

    // body parser
    bodyParser: {
      json(options?: JsonBodyOptions): Handler;
      urlencoded(options?: UrlencodedOptions): Handler;
      multipart(options?: MultipartOptions): Handler;
    };

    // static files
    static(root: string, options?: { maxAge?: number; index?: string }): Handler;

    // error handler
    error(res: Response, obj: any): void;

    // settings
    set(key: string, value: any): this;
    get(key: string): any;

    // debug
    debug(value?: boolean | string): this;

    // utilities
    listRoutes(): { method: string; path: string | string[]; middlewares: number }[];
    printRoutes(): void;

    // server control
    listen(port: number, host?: string, callback?: () => void): any;
    listen(...args: any[]): any;
  }

  // -------------- Factory / Constructor --------------
  interface ConstructorOptions {
    // initial options
    cors?: Partial<CorsOptions>;
    bodyParser?: Partial<BodyParserOptions>;
    trustProxy?: boolean | string | string[];
    debug?: boolean;
    allowTrailingSlash?: boolean;
    strictTrailingSlash?: boolean;
    // other global options
    [key: string]: any;
  }

  interface LiekoStatic {
    (opts?: ConstructorOptions): App;

    // expose helpers statically if present in runtime
    Router: () => App;
    Schema: typeof Schema;
    schema: (...args: any[]) => Schema;
    validators: Validators;
    validate: typeof validate;
    validatePartial: (schema: Schema) => Handler;
    ValidationError: typeof ValidationError;
    static: (root: string, options?: { maxAge?: number; index?: string }) => Handler;
  }
}

declare const Lieko: Lieko.LiekoStatic;
export = Lieko;