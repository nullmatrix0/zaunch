import * as Client from '@storacha/client';
import * as Proof from '@storacha/client/proof';
import { StoreMemory } from '@storacha/client/stores/memory';
import * as Ed25519 from '@ucanto/principal/ed25519';

import { type TokenMetadata } from '../types';

export class IPFSService {
  private client: Client.Client | null = null;
  private email: string;
  private privateKey?: string;
  private proof?: string;
  private spaceDid?: string;

  constructor(email: string, privateKey?: string, proof?: string, spaceDid?: string) {
    this.email = email;
    this.privateKey = privateKey;
    this.proof = proof;
    this.spaceDid = spaceDid;
  }

  // Initialize Storacha client
  private async getClient(): Promise<Client.Client> {
    if (this.client) {
      return this.client;
    }

    try {
      // Create client with memory store
      const principal = this.privateKey ? Ed25519.parse(this.privateKey) : await Ed25519.generate();

      this.client = await Client.create({ principal, store: new StoreMemory() });

      // If we have proof and space DID, use them for authentication
      if (this.proof && this.spaceDid) {
        try {
          const proofData = await Proof.parse(this.proof);
          const space = await this.client.addSpace(proofData);
          await this.client.setCurrentSpace(space.did());
          console.log('Successfully authenticated with proof and space DID:', this.spaceDid);
        } catch (proofError) {
          console.error('Error setting up space with proof:', proofError);
          throw new Error(
            `Failed to authenticate with proof. Make sure STORACHA_PROOF and STORACHA_SPACE_DID are valid. Error: ${proofError}`,
          );
        }
      } else {
        // Otherwise use email login (requires manual confirmation)
        console.warn(
          'No proof provided. Using email login - this requires manual confirmation and is not recommended for production.',
        );
        try {
          const account = await this.client.login(`${this.email}@${this.email}`);
          await account.plan.wait();

          // Create or select a space
          const spaces = await this.client.spaces();
          if (spaces.length === 0) {
            await this.client.createSpace('zaunchpad', { account });
          } else {
            await this.client.setCurrentSpace(spaces[0]?.did() || 'did:storacha:space:default');
          }
        } catch (loginError) {
          console.error('Error during email login:', loginError);
          throw new Error(`Failed to login with email. Error: ${loginError}`);
        }
      }

      // Verify we have a current space
      const currentSpace = this.client.currentSpace();
      if (!currentSpace) {
        throw new Error('No space is currently set. Please check your Storacha configuration.');
      }
      console.log('Current space:', currentSpace.did());

      return this.client;
    } catch (error) {
      console.error('Error initializing Storacha client:', error);
      throw new Error(`Failed to initialize Storacha client: ${error}`);
    }
  }

  // Upload file to Storacha and get IPFS URI
  private async uploadToStoracha(buffer: Buffer, fileName: string): Promise<string> {
    try {
      const client = await this.getClient();

      console.log(`Uploading file: ${fileName}, size: ${buffer.length} bytes`);

      // Create a File object from buffer
      const blob = new Blob([buffer]);
      const file = new File([blob], fileName);

      // Upload file and get CID
      const cid = await client.uploadFile(file);

      const ipfsUri = `https://${cid.toString()}.ipfs.w3s.link`;
      console.log(`Successfully uploaded ${fileName}, URI:`, ipfsUri);
      return ipfsUri;
    } catch (error) {
      console.error('Error uploading to Storacha:', error);
      // Log more details about the error
      if (error && typeof error === 'object' && 'cause' in error) {
        console.error('Error cause:', error.cause);
      }
      throw error;
    }
  }

  // create metadata JSON from token config
  private createMetadataJson(
    name: string,
    symbol: string,
    description: string,
    imageUri: string,
    bannerUri: string,
    website: string,
    twitter: string,
    telegram: string,
  ): TokenMetadata {
    const metadata = {
      name: name,
      symbol: symbol,
      description: description,
      image: imageUri,
      banner: bannerUri,
      website: website,
      twitter: twitter,
      telegram: telegram,
    };

    return metadata;
  }

  // upload metadata JSON
  async uploadTokenMetadata(
    name: string,
    symbol: string,
    imageUri: string,
    bannerUri: string,
    description: string,
    website: string,
    twitter: string,
    telegram: string,
  ): Promise<string> {
    const metadataJson = this.createMetadataJson(
      name,
      symbol,
      description,
      imageUri,
      bannerUri,
      website,
      twitter,
      telegram,
    );

    try {
      const timestamp = Date.now();
      const fileName = `metadata_${symbol}_${timestamp}.json`;
      const metadataBuffer = Buffer.from(JSON.stringify(metadataJson));
      const uri = await this.uploadToStoracha(metadataBuffer, fileName);

      console.log('Metadata IPFS URI:', uri);
      return uri;
    } catch (error) {
      console.error('Error uploading metadata:', error);
      throw new Error(`Failed to upload metadata: ${error}`);
    }
  }

  // upload image file to Storacha
  async uploadImage(imageFile: File, fileName?: string): Promise<string> {
    console.log('Uploading image to Storacha...');

    try {
      // Convert File to ArrayBuffer then to Buffer
      const arrayBuffer = await imageFile.arrayBuffer();
      const imageBuffer = Buffer.from(arrayBuffer);

      // Use provided fileName or fallback to file.name
      const finalFileName = fileName || imageFile.name || 'image.png';

      // Upload to Storacha and get IPFS URI
      const uri = await this.uploadToStoracha(imageBuffer, finalFileName);

      console.log('Image IPFS URI:', uri);
      return uri;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw new Error(`Failed to upload image: ${error}`);
    }
  }
}
