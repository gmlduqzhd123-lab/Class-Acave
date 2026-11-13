declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    WORKSPACE_OWNER_EMAIL?: string;
    WORKSPACE_INVITE_EMAILS?: string;
    APP_MANAGED_INVITES?: string;
    INVITE_MAIL_URL?: string;
    INVITE_MAIL_SECRET?: string;
  }
}
