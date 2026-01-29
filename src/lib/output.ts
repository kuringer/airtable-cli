// Output formatting utilities

export type OutputFormat = 'json' | 'table' | 'csv';

export function formatOutput(
  data: unknown,
  format: OutputFormat = 'json'
): string {
  switch (format) {
    case 'json':
      return JSON.stringify(data, null, 2);
    case 'table':
      return formatAsTable(data);
    case 'csv':
      return formatAsCsv(data);
    default:
      return JSON.stringify(data, null, 2);
  }
}

function formatAsTable(data: unknown): string {
  if (!data) return '';

  // Handle arrays of records
  if (Array.isArray(data)) {
    if (data.length === 0) return 'No records found.';

    // Get all unique keys from all records
    const allKeys = new Set<string>();
    data.forEach((item) => {
      if (typeof item === 'object' && item !== null) {
        // Handle Airtable records with fields
        if ('fields' in item && typeof item.fields === 'object') {
          Object.keys(item.fields as object).forEach((k) => allKeys.add(k));
          if ('id' in item) allKeys.add('id');
        } else {
          Object.keys(item).forEach((k) => allKeys.add(k));
        }
      }
    });

    const keys = Array.from(allKeys);
    if (keys.length === 0) return JSON.stringify(data, null, 2);

    // Calculate column widths
    const widths: Record<string, number> = {};
    keys.forEach((key) => {
      widths[key] = key.length;
    });

    data.forEach((item) => {
      if (typeof item === 'object' && item !== null) {
        const record = 'fields' in item ? { id: (item as { id?: string }).id, ...(item as { fields: object }).fields } : item;
        keys.forEach((key) => {
          const value = String((record as Record<string, unknown>)[key] ?? '');
          widths[key] = Math.max(widths[key], Math.min(value.length, 50));
        });
      }
    });

    // Build table
    const separator =
      '+' + keys.map((k) => '-'.repeat(widths[k] + 2)).join('+') + '+';
    const header =
      '|' +
      keys.map((k) => ` ${k.padEnd(widths[k])} `).join('|') +
      '|';

    const rows = data.map((item) => {
      if (typeof item === 'object' && item !== null) {
        const record = 'fields' in item ? { id: (item as { id?: string }).id, ...(item as { fields: object }).fields } : item;
        return (
          '|' +
          keys
            .map((k) => {
              let value = String((record as Record<string, unknown>)[k] ?? '');
              if (value.length > 50) value = value.substring(0, 47) + '...';
              return ` ${value.padEnd(widths[k])} `;
            })
            .join('|') +
          '|'
        );
      }
      return String(item);
    });

    return [separator, header, separator, ...rows, separator].join('\n');
  }

  // Handle single object
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;
    const lines: string[] = [];
    const maxKeyLen = Math.max(...Object.keys(obj).map((k) => k.length));

    for (const [key, value] of Object.entries(obj)) {
      const valueStr =
        typeof value === 'object'
          ? JSON.stringify(value)
          : String(value ?? '');
      lines.push(`${key.padEnd(maxKeyLen)} : ${valueStr}`);
    }

    return lines.join('\n');
  }

  return String(data);
}

function formatAsCsv(data: unknown): string {
  if (!Array.isArray(data) || data.length === 0) {
    return '';
  }

  // Get all unique keys
  const allKeys = new Set<string>();
  data.forEach((item) => {
    if (typeof item === 'object' && item !== null) {
      if ('fields' in item && typeof item.fields === 'object') {
        Object.keys(item.fields as object).forEach((k) => allKeys.add(k));
        if ('id' in item) allKeys.add('id');
      } else {
        Object.keys(item).forEach((k) => allKeys.add(k));
      }
    }
  });

  const keys = Array.from(allKeys);
  const escapeCsv = (val: unknown): string => {
    const str = typeof val === 'object' ? JSON.stringify(val) : String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const header = keys.map(escapeCsv).join(',');
  const rows = data.map((item) => {
    if (typeof item === 'object' && item !== null) {
      const record = 'fields' in item ? { id: (item as { id?: string }).id, ...(item as { fields: object }).fields } : item;
      return keys.map((k) => escapeCsv((record as Record<string, unknown>)[k])).join(',');
    }
    return escapeCsv(item);
  });

  return [header, ...rows].join('\n');
}

export function printOutput(
  data: unknown,
  format: OutputFormat = 'json'
): void {
  console.log(formatOutput(data, format));
}

export function printError(message: string): void {
  console.error(`Error: ${message}`);
}

export function printSuccess(message: string): void {
  console.log(`Success: ${message}`);
}
