export type CustomProviderFrom =
  | {
      type: 'container.from_image_ref';
      imageRef: string;
      username?: string;
      password?: string;
    }
  | {
      type: 'remote';
      remoteUrl: string;
      protocol: 'sse' | 'streamable_http';
      oauthConfig?: Record<string, any>;
    }
  | {
      type: 'function';
      files: {
        filename: string;
        content: string;
        encoding?: 'utf-8' | 'base64';
      }[];
      env: Record<string, string>;
      runtime:
        | { identifier: 'nodejs'; version: '24.x' | '22.x' }
        | { identifier: 'python'; version: '3.14' | '3.13' | '3.12' };
    };

export type CustomProviderConfig = {
  schema: Record<string, any>;
  transformer: string;
};
