declare module 'transit-js' {
  export interface TransitWriter {
    write(obj: any): string;
  }

  export interface TransitReader {
    read(str: string): any;
  }

  export function writer(type: string): TransitWriter;
  export function reader(type: string): TransitReader;
}