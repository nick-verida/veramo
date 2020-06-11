import { AbstractIdentityProvider } from './abstract/abstract-identity-provider'
import { IAgentPlugin, IIdentity, IService, IKey, IAgentBase } from './types'
import { AbstractIdentityStore } from './abstract/abstract-identity-store'
import { IAgentKeyManager } from './key-manager'

export interface IAgentIdentityManager {
  identityManagerGetProviders?: () => Promise<string[]>
  identityManagerGetIdentities?: () => Promise<IIdentity[]>
  identityManagerGetIdentity?: (args: { did: string }) => Promise<IIdentity>
  identityManagerCreateIdentity?: (args: {
    alias?: string
    provider?: string
    kms?: string
    options?: any
  }) => Promise<IIdentity>
  // identityManagerGetOrCreateIdentity?: (args: { alias: string, provider?: string, kms?: string, options?: any}) => Promise<IIdentity>
  identityManagerImportIdentity?: (args: IIdentity) => Promise<IIdentity>
  identityManagerDeleteIdentity?: (args: { did: string }) => Promise<boolean>
  identityManagerAddKey?: (args: { did: string; key: IKey; options?: any }) => Promise<any> // txHash?
  identityManagerRemoveKey?: (args: { did: string; kid: string; options?: any }) => Promise<any> // txHash?
  identityManagerAddService?: (args: { did: string; service: IService; options?: any }) => Promise<any> //txHash?
  identityManagerRemoveService?: (args: { did: string; id: string; options?: any }) => Promise<any> //txHash?
}

interface IContext {
  agent: IAgentBase & IAgentKeyManager
}

export class IdentityManager implements IAgentPlugin {
  readonly methods: Required<IAgentIdentityManager>
  private providers: Record<string, AbstractIdentityProvider>
  private defaultProvider: string
  private store: AbstractIdentityStore

  constructor(options: {
    providers: Record<string, AbstractIdentityProvider>
    defaultProvider: string
    store: AbstractIdentityStore
  }) {
    this.providers = options.providers
    this.defaultProvider = options.defaultProvider
    this.store = options.store
    this.methods = {
      identityManagerGetProviders: this.identityManagerGetProviders.bind(this),
      identityManagerGetIdentities: this.identityManagerGetIdentities.bind(this),
      identityManagerGetIdentity: this.identityManagerGetIdentity.bind(this),
      identityManagerCreateIdentity: this.identityManagerCreateIdentity.bind(this),
      identityManagerImportIdentity: this.identityManagerImportIdentity.bind(this),
      identityManagerDeleteIdentity: this.identityManagerDeleteIdentity.bind(this),
      identityManagerAddKey: this.identityManagerAddKey.bind(this),
      identityManagerRemoveKey: this.identityManagerRemoveKey.bind(this),
      identityManagerAddService: this.identityManagerAddService.bind(this),
      identityManagerRemoveService: this.identityManagerRemoveService.bind(this),
    }
  }

  private getProvider(name: string): AbstractIdentityProvider {
    const provider = this.providers[name]
    if (!provider) throw Error('Identity provider does not exist: ' + name)
    return provider
  }

  async identityManagerGetProviders(): Promise<string[]> {
    return Object.keys(this.providers)
  }

  async identityManagerGetIdentities(): Promise<IIdentity[]> {
    return this.store.list()
  }

  async identityManagerGetIdentity({ did }: { did: string }): Promise<IIdentity> {
    return this.store.get({ did })
  }

  async identityManagerCreateIdentity(
    { provider, alias, kms, options }: { alias?: string; provider?: string; kms?: string; options?: any },
    context: IContext,
  ): Promise<IIdentity> {
    const identityProvider = this.getProvider(provider || this.defaultProvider)
    const partialIdentity = await identityProvider.createIdentity({ kms, options }, context)
    const identity: IIdentity = {...partialIdentity, alias, provider}
    await this.store.import(identity)
    return identity
  }

  async identityManagerImportIdentity(identity: IIdentity): Promise<IIdentity> {
    await this.store.import(identity)
    return identity
  }

  async identityManagerDeleteIdentity({ did }: { did: string }, context: IContext): Promise<boolean> {
    const identity = await this.store.get({ did })
    const provider = this.getProvider(identity.provider)
    await provider.deleteIdentity(identity, context)
    return this.store.delete({ did })
  }

  async identityManagerAddKey({
    did,
    key,
    options,
  }: {
    did: string
    key: IKey
    options?: any
  }): Promise<any> {
    const identity = await this.store.get({ did })
    const provider = this.getProvider(identity.provider)
    const result = await provider.addKey({ did, key, options })
    identity.keys.push(key)
    await this.store.import(identity)
    return result
  }

  async identityManagerRemoveKey({
    did,
    kid,
    options,
  }: {
    did: string
    kid: string
    options?: any
  }): Promise<any> {
    const identity = await this.store.get({ did })
    const provider = this.getProvider(identity.provider)
    const result = await provider.removeKey({ did, kid, options })
    identity.keys = identity.keys.filter(k => k.kid !== kid)
    await this.store.import(identity)
    return result
  }

  async identityManagerAddService({
    did,
    service,
    options,
  }: {
    did: string
    service: IService
    options?: any
  }): Promise<any> {
    const identity = await this.store.get({ did })
    const provider = this.getProvider(identity.provider)
    const result = await provider.addService({ did, service, options })
    identity.services.push(service)
    await this.store.import(identity)
    return result
  }

  async identityManagerRemoveService({
    did,
    id,
    options,
  }: {
    did: string
    id: string
    options?: any
  }): Promise<any> {
    const identity = await this.store.get({ did })
    const provider = this.getProvider(identity.provider)
    const result = await provider.removeService({ did, id, options })
    identity.services = identity.services.filter(s => s.id !== id)
    await this.store.import(identity)
    return result
  }
}