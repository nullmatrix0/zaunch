// Type declarations for @storacha packages
declare module '@storacha/client' {
  export interface Client {
    uploadFile(file: File): Promise<any>;
    currentSpace(): any;
    spaces(): Promise<any[]>;
    createSpace(name: string, options?: any): Promise<any>;
    setCurrentSpace(did: string): Promise<void>;
    addSpace(proof: any): Promise<any>;
    login(email: string): Promise<any>;
  }

  export function create(options: { principal: any; store: any }): Promise<Client>;
}

declare module '@storacha/client/proof' {
  export function parse(proof: string): Promise<any>;
}

declare module '@storacha/client/stores/memory' {
  export class StoreMemory {
    constructor();
  }
}

declare module '@ucanto/principal/ed25519' {
  export function parse(key: string): any;
  export function generate(): Promise<any>;
}
