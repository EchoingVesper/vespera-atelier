declare module 'transit-js' {
  export interface TransitWriter {
    write(obj: any): string;
  }

  export interface TransitReader {
    read(str: string): any;
  }

  export interface TransitKeyword {
    toString(): string;
  }

  export interface TransitMap {
    get(key: any): any;
    set(key: any, value: any): void;
  }

  export function writer(type: string): TransitWriter;
  export function reader(type: string): TransitReader;
  export function keyword(name: string): TransitKeyword;
  export function map(keyValuePairs: any[]): TransitMap;
}