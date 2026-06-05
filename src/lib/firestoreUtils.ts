export function sanitizeForFirestore<T extends Record<string, any>>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForFirestore(item)) as unknown as T;
  }

  // Preserve Date, Timestamp and FieldValue
  if (
    obj instanceof Date || 
    (typeof obj.toDate === 'function' && typeof obj.seconds === 'number') || // Timestamp
    (obj.constructor && obj.constructor.name === 'FieldValueImpl') || // FieldValue
    (obj.constructor && obj.constructor.name === 'ServerTimestampTransform') ||
    (obj._methodName)
  ) {
    return obj;
  }

  const cleaned: Record<string, any> = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      if (value !== undefined) {
        if (typeof value === 'object' && value !== null) {
          cleaned[key] = sanitizeForFirestore(value);
        } else {
          cleaned[key] = value;
        }
      }
    }
  }
  
  return cleaned as T;
}
