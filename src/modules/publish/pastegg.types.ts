export namespace PasteGG {

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