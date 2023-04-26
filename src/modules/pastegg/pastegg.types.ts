export namespace PasteGG {

  /// Client (Browser) -> Server (Next.js)
  export namespace API {
    export namespace Publish {
      export interface RequestBody {
        to: 'paste.gg';
        title: string;
        fileContent: string;
        fileName: string;
        origin: string;
      }

      export type Response = {
        type: 'success';
        url: string;
        expires: string;
        deletionKey: string;
        created: string;
      } | {
        type: 'error';
        error: string
      };
    }
  }

  /// This is the upstream API, for Server (Next.js) -> Upstream Server
  export namespace Wire {
    export interface PasteRequest {
      name?: string;
      description?: string;
      visibility?: 'public' | 'unlisted' | 'private';
      expires?: string;
      files: PasteFile[];
    }

    interface PasteFile {
      name?: string;
      content: {
        format: 'text' | 'base64' | 'gzip' | 'xz';
        highlight_language?: string | null;
        value: string;
      };
    }

    export type PasteResponse = {
      status: 'success'
      result: PasteRequest & {
        id: string;
        created_at: string;
        updated_at: string;
        files: {
          id: string;
          name: string;
          highlight_language?: string | null;
        }[];
        deletion_key?: string;
      };
    } | {
      status: 'error';
      error: string;
      message?: string;
    }
  }
}