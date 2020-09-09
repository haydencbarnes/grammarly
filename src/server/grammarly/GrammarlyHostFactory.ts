import { Grammarly } from '@/server/grammarly/Grammarly';
import { anonymous, authenticate, GrammarlyAuthContext } from '@/server/grammarly/GrammarlyAuth';
import { GrammarlyDocument } from '@/server/grammarly/GrammarlyDocument';
import { GrammarlyError, WebSocketErrorCode } from '@/server/grammarly/GrammarlyWebSocketClient';
import { TextGrammarCheckHost } from '@/server/grammarly/hosts/TextGrammarCheckHost';

export class GrammarlyHostFactory {
  private auth: GrammarlyAuthContext | null = null;

  constructor(
    private getDocumentContext: (document: GrammarlyDocument) => Promise<Grammarly.DocumentContext>,
    private getCredentials: () => Promise<{ username: string; password: string } | string>,
    private storeToken: (token: string | null) => void
  ) {}

  public create(document: GrammarlyDocument) {
    const host = new TextGrammarCheckHost(
      document,
      () => this.getDocumentContext(document),
      () => this.getAuth(),
      (error) => {
        if (error instanceof GrammarlyError) {
          if (error.code === WebSocketErrorCode.UNAUTHORIZED) {
            this.auth = null;
            // @ts-ignore - accessing private property.
            host.api.reconnect();
          }
        }
      }
    );

    return host;
  }

  private async getAuth(): Promise<GrammarlyAuthContext> {
    if (!this.auth) {
      try {
        this.auth = await this.asUser();
      } catch {
        // Ignore for now.
      }
    }

    return this.auth || this.asAnonymous();
  }

  private async asAnonymous() {
    return (this.auth = await anonymous());
  }

  private async asUser() {
    const credentials = await this.getCredentials();

    if (typeof credentials === 'string') {
      return JSON.parse(credentials);
    } else if (credentials) {
      this.auth = await authenticate(credentials.username, credentials.password);
      if (this.auth) this.storeToken(JSON.stringify(this.auth));
    }
  }
}