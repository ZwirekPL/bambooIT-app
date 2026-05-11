// Email block-based template renderer
// Converts a JSON block structure into professional HTML email

export interface HeadingBlock {
  type: 'HEADING';
  text: string;
  size?: 'h1' | 'h2' | 'h3';
}

export interface TextBlock {
  type: 'TEXT';
  text: string;
}

export interface ListBlock {
  type: 'LIST';
  items: string[];
}

export interface CtaBlock {
  type: 'CTA';
  label: string;
  url: string;
  color?: 'green' | 'blue' | 'gray';
}

export interface DividerBlock {
  type: 'DIVIDER';
}

export interface ImageBlock {
  type: 'IMAGE';
  url: string;
  alt?: string;
  linkUrl?: string;
  width?: number; // px — omit for 100%
}

export interface VideoBlock {
  type: 'VIDEO';
  videoUrl: string;
  thumbnailUrl?: string;
  caption?: string;
}

export interface UnsubscribeBlock {
  type: 'UNSUBSCRIBE';
  text?: string; // custom label, defaults to 'Zrezygnuj z powiadomień'
}

export type EmailBlock = HeadingBlock | TextBlock | ListBlock | CtaBlock | DividerBlock | ImageBlock | VideoBlock | UnsubscribeBlock;

export interface EmailBlockTemplate {
  version: 1;
  blocks: EmailBlock[];
}

const ALLOWED_VARS = ['patientName', 'weightTrend', 'compliance', 'tip', 'achievement', 'unsubscribeUrl'] as const;
export type TemplateVars = Partial<Record<typeof ALLOWED_VARS[number], string>>;

// Safe variable interpolation — whitelist only, no eval
export function interpolate(text: string, vars: TemplateVars): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    if ((ALLOWED_VARS as readonly string[]).includes(key)) {
      return vars[key as keyof TemplateVars] ?? '';
    }
    return '';
  });
}

const CTA_COLORS: Record<NonNullable<CtaBlock['color']>, string> = {
  green: '#16a34a',
  blue:  '#2563eb',
  gray:  '#6b7280',
};

// Render simple markdown-like formatting to HTML.
// Supports: **bold**, _italic_, [label](url)
function renderRichText(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" style="color:#16a34a;text-decoration:underline;">$1</a>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/_([^_\n]+)_/g, '<em>$1</em>');
}

function renderBlock(block: EmailBlock, vars: TemplateVars): string {
  switch (block.type) {
    case 'HEADING': {
      const text = interpolate(block.text, vars);
      const fs = block.size === 'h1' ? '24px' : block.size === 'h3' ? '16px' : '20px';
      return `
        <div style="background: linear-gradient(135deg, #16a34a, #15803d); color: #ffffff;
                    padding: 18px 24px; border-radius: 8px; margin: 0 0 20px;">
          <p style="margin:0; font-size:${fs}; font-weight:bold; line-height:1.3;">${text}</p>
        </div>`;
    }

    case 'TEXT': {
      const paragraphs = interpolate(block.text, vars)
        .split('\n')
        .filter(Boolean)
        .map((p) => `<p style="color:#374151; font-size:15px; line-height:1.6; margin:0 0 12px;">${renderRichText(p)}</p>`)
        .join('');
      return `<div style="margin:0 0 16px;">${paragraphs}</div>`;
    }

    case 'LIST': {
      const items = block.items
        .filter(Boolean)
        .map((item) => {
          const text = renderRichText(interpolate(item, vars));
          return `<li style="padding:8px 0 8px 28px; position:relative; border-bottom:1px solid #f3f4f6;
                             color:#374151; font-size:14px; list-style:none;">
            <span style="position:absolute; left:0; color:#16a34a; font-weight:bold;">✓</span>
            ${text}
          </li>`;
        })
        .join('');
      return `<ul style="padding:0; margin:0 0 20px;">${items}</ul>`;
    }

    case 'CTA': {
      const label = interpolate(block.label, vars);
      const color = CTA_COLORS[block.color ?? 'green'];
      return `
        <p style="text-align:center; margin:24px 0;">
          <a href="${block.url}"
             style="background-color:${color}; color:#ffffff; padding:13px 30px;
                    border-radius:6px; text-decoration:none; font-weight:bold;
                    font-size:15px; display:inline-block;">
            ${label}
          </a>
        </p>
        <p style="text-align:center; font-size:12px; color:#9ca3af; margin:0 0 16px;">
          Jeśli przycisk nie działa, skopiuj link: <a href="${block.url}" style="color:#16a34a;">${block.url}</a>
        </p>`;
    }

    case 'DIVIDER':
      return `<hr style="border:none; border-top:1px solid #e5e7eb; margin:20px 0;" />`;

    case 'IMAGE': {
      const w = block.width ? `${block.width}px` : '100%';
      const img = `<img src="${block.url}" alt="${block.alt ?? ''}" style="max-width:100%; width:${w}; height:auto; display:block; border-radius:6px; margin:0 auto;" />`;
      const wrapped = block.linkUrl ? `<a href="${block.linkUrl}" style="display:block;">${img}</a>` : img;
      return `<div style="margin:0 0 20px; text-align:center;">${wrapped}</div>`;
    }

    case 'UNSUBSCRIBE': {
      const label = block.text ?? 'Zrezygnuj z powiadomień';
      const url = vars.unsubscribeUrl ?? '#';
      return `
        <p style="text-align:center; margin:24px 0 0;">
          <a href="${url}"
             style="font-size:12px; color:#9ca3af; text-decoration:underline;">
            ${label}
          </a>
        </p>`;
    }

    case 'VIDEO': {
      const caption = block.caption
        ? `<p style="text-align:center; font-size:13px; color:#6b7280; margin:8px 0 0;">${block.caption}</p>`
        : '';
      const btn = `<p style="text-align:center; margin:12px 0 0;"><a href="${block.videoUrl}" style="background-color:#dc2626; color:#fff; padding:10px 24px; border-radius:6px; text-decoration:none; font-weight:bold; font-size:14px; display:inline-block;">&#9654;&nbsp;Obejrzyj film</a></p>`;
      if (block.thumbnailUrl) {
        return `<div style="margin:0 0 20px; text-align:center;"><a href="${block.videoUrl}"><img src="${block.thumbnailUrl}" alt="Miniatura wideo" style="max-width:100%; border-radius:8px; display:block; margin:0 auto;" /></a>${btn}${caption}</div>`;
      }
      return `<div style="margin:0 0 20px;">${btn}${caption}</div>`;
    }
  }
}

// Renders blocks to an HTML body fragment (no outer layout)
export function renderBlocksToHtml(template: EmailBlockTemplate, vars: TemplateVars): string {
  return template.blocks.map((block) => renderBlock(block, vars)).join('\n');
}

// Wraps body fragment in a full professional email layout
export function wrapInEmailLayout(
  body: string,
  title: string,
  trackingPixelId?: string,
  unsubscribeUrl?: string,
): string {
  const appUrl = process.env.APP_URL ?? 'https://e-dietetyk.com';
  const pixel = trackingPixelId
    ? `<img src="${appUrl}/api/email-campaigns/track/open/${trackingPixelId}" width="1" height="1" style="display:block;" alt="" />`
    : '';
  const unsubscribeLink = unsubscribeUrl
    ? `<p style="margin:6px 0 0; font-size:11px; text-align:center;"><a href="${unsubscribeUrl}" style="color:#9ca3af; text-decoration:underline;">Zrezygnuj z powiadomień</a></p>`
    : '';

  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0; padding:0; background-color:#f9fafb; font-family:Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb; padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0"
               style="max-width:600px; width:100%; background:#ffffff; border-radius:12px;
                      overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg, #15803d, #166534); padding:28px 32px;">
              <p style="margin:0; font-size:22px; font-weight:bold; color:#ffffff;">
                🌿 e-dietetyk.com
              </p>
              <p style="margin:6px 0 0; font-size:14px; color:#bbf7d0;">
                Twój osobisty asystent żywieniowy
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              ${body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb; padding:20px 32px; border-top:1px solid #e5e7eb;">
              <p style="margin:0; font-size:12px; color:#9ca3af; text-align:center;">
                e-dietetyk.com — Twój osobisty asystent żywieniowy
              </p>
              <p style="margin:6px 0 0; font-size:11px; color:#d1d5db; text-align:center;">
                Otrzymujesz tę wiadomość, ponieważ jesteś użytkownikiem platformy e-dietetyk.com.
              </p>
              ${unsubscribeLink}
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
  ${pixel}
</body>
</html>`;
}
