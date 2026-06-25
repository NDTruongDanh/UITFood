import { EVENT_NAMES } from './event-names';
import { EVENT_PAYLOAD_SCHEMAS } from './index';
import { describe, it, expect } from '@jest/globals';

describe('Contracts Compatibility', () => {
  it('should have a schema for every defined event name', () => {
    const definedEvents = Object.values(EVENT_NAMES);
    
    for (const eventName of definedEvents) {
      expect(EVENT_PAYLOAD_SCHEMAS[eventName]).toBeDefined();
    }
  });
  
  it('schemas should be valid Zod objects', () => {
    for (const [eventName, schema] of Object.entries(EVENT_PAYLOAD_SCHEMAS)) {
      expect(schema).toHaveProperty('parse');
      expect(schema).toHaveProperty('safeParse');
    }
  });
});
