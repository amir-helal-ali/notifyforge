/**
 * Template engine — renders a template body by substituting {{variable}} placeholders.
 *
 * Supports:
 *   - Simple variables: {{name}}
 *   - Nested paths: {{user.profile.name}}
 *   - Default values: {{name|anonymous}}
 *   - Escaping: HTML-escapes strings by default, raw via {{html|raw}}
 *
 * Variables that are missing resolve to empty string (with optional default).
 * The engine is intentionally minimal — no control flow, no loops — to keep
 * templates safe for user-supplied content.
 */

export interface RenderedTemplate {
  subject?: string;
  body: string;
  html?: string;
  missing: string[];
}

export function renderTemplate(
  template: string,
  variables: Record<string, unknown> = {},
): { rendered: string; missing: string[] } {
  const missing: string[] = [];
  const pattern = /\{\{\s*([^}]+?)\s*\}\}/g;
  const rendered = template.replace(pattern, (match, expr: string) => {
    const [path, ...modifierParts] = expr.split('|');
    const modifier = modifierParts.join('|').trim();
    const value = resolvePath(variables, path.trim());
    if (value === undefined || value === null) {
      if (modifier && modifier !== 'raw') {
        return modifier;
      }
      missing.push(path.trim());
      return '';
    }
    if (modifier === 'raw') return String(value);
    return escapeHtml(String(value));
  });
  return { rendered, missing };
}

function resolvePath(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function validateTemplateVariables(
  template: string,
  schema?: Record<string, unknown> | null,
): { valid: boolean; required: string[]; missing: string[] } {
  // Extract all variables referenced in the template
  const pattern = /\{\{\s*([^}|]+?)(?:\|[^}]*)?\s*\}\}/g;
  const referenced = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(template)) !== null) {
    referenced.add(m[1].trim());
  }
  const required = Array.from(referenced);
  if (!schema) return { valid: true, required, missing: [] };
  // Check schema has all required keys
  const schemaKeys = new Set(Object.keys(schema));
  const missing = required.filter((r) => !schemaKeys.has(r.split('.')[0]));
  return { valid: missing.length === 0, required, missing };
}

/**
 * Render a full template (subject + body) given variables.
 */
export function renderFullTemplate(
  template: { subject?: string | null; body: string },
  variables: Record<string, unknown> = {},
): RenderedTemplate {
  const bodyResult = renderTemplate(template.body, variables);
  let subject: string | undefined;
  if (template.subject) {
    const subjectResult = renderTemplate(template.subject, variables);
    subject = subjectResult.rendered;
  }
  return {
    subject,
    body: bodyResult.rendered,
    missing: bodyResult.missing,
  };
}
