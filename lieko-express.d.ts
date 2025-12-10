declare module "lieko-express" {
  import { IncomingMessage, ServerResponse } from "http";

  // -------------------------------
  // Request Extensions
  // -------------------------------
  interface LiekoRequest extends IncomingMessage {
    app: any;

    // Passport fields
    user?: any;
    session?: any;

    // Auth helpers
    logout(callback?: (err: any) => void): Promise<void> | void;

    // URL helpers
    originalUrl: string;
    params: Record<string, string>;
    query: Record<string, any>;
    body: any;
    files: Record<string, any>;
    xhr: boolean;

    // IP helpers
    ip: {
      raw: string | null;
      ipv4: string | null;
      ipv6: string | null;
      display: string;
    };
    ips: string[];

    protocol: string;
    secure: boolean;
    hostname: string;
    subdomains: string[];

    get(name: string): string | undefined;
    header(name: string): string | undefined;

    accepts(types: string | string[]): string | false;
    acceptsLanguages(langs: string | string[]): string | false;
    acceptsCharsets(charsets: string | string[]): string | false;
    acceptsEncodings(enc: string | string[]): string | false;

    is(type: string): boolean;
  }

  // -------------------------------
  // Response Extensions
  // -------------------------------
  interface LiekoResponse extends ServerResponse {
    app: any;
    locals: Record<string, any>;

    status(code: number): this;
    set(name: string, value: string): this;
    header(name: string, value: string): this;
    type(mime: string): this;

    json(data: any): this;
    send(data: any): this;
    html(html: string, status?: number): this;

    redirect(url: string, status?: number): this;

    ok(data: any, message?: string): this;
    success(data: any, message?: string): this;
    created(data: any, message?: string): this;
    noContent(): this;
    accepted(data?: any, message?: string): this;
    paginated(items: any[], total: number, message?: string): this;

    // Cookie helpers
    cookie(
      name: string,
      value: string,
      options?: {
        path?: string;
        httpOnly?: boolean;
        secure?: boolean;
        sameSite?: "lax" | "strict" | "none";
        maxAge?: number;
        expires?: Date;
        domain?: string;
      }
    ): this;

    clearCookie(
      name: string,
      options?: {
        path?: string;
        httpOnly?: boolean;
        secure?: boolean;
        sameSite?: "lax" | "strict" | "none";
      }
    ): this;

    error(obj: any): this;
    fail(obj: any): this;
    badRequest(msg?: string): this;
    unauthorized(msg?: string): this;
    forbidden(msg?: string): this;
    notFound(msg?: string): this;
    serverError(msg?: string): this;
  }

  // -------------------------------
  // Handler Types
  // -------------------------------
  type LiekoHandler = (
    req: LiekoRequest,
    res: LiekoResponse,
    next: (err?: any) => void
  ) => any;

  type LiekoErrorHandler = (
    err: any,
    req: LiekoRequest,
    res: LiekoResponse,
    next: (err?: any) => void
  ) => any;

  // -------------------------------
  // Router / App Class
  // -------------------------------
  class LiekoExpress {
    constructor();

    get(path: string, ...handlers: LiekoHandler[]): this;
    post(path: string, ...handlers: LiekoHandler[]): this;
    put(path: string, ...handlers: LiekoHandler[]): this;
    patch(path: string, ...handlers: LiekoHandler[]): this;
    delete(path: string, ...handlers: LiekoHandler[]): this;
    all(path: string, ...handlers: LiekoHandler[]): this;

    use(mw: LiekoHandler): this;
    use(path: string, mw: LiekoHandler): this;
    use(path: string, router: LiekoExpress): this;
    use(path: string, mw: LiekoHandler, router: LiekoExpress): this;

    group(
      basePath: string,
      ...middlewares: LiekoHandler[]
    ): this;

    errorHandler(handler: LiekoErrorHandler): this;
    notFound(handler: LiekoHandler): this;

    set(name: string, value: any): this;
    get(setting: string): any;

    listen(port: number, host?: string, callback?: () => void): any;
  }

  function Lieko(): LiekoExpress;
  function Router(): LiekoExpress;

  export = Lieko;
}
