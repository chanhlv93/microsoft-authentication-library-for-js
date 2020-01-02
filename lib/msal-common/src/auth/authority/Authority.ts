/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { ITenantDiscoveryResponse } from "./ITenantDiscoveryResponse";
import { UrlString } from "../../url/UrlString";
import { IUri } from "../../url/IUri";
import { ClientAuthError } from "../../error/ClientAuthError";
import { INetworkModule } from "../../network/INetworkModule";

/**
 * @hidden
 */
export enum AuthorityType {
    Aad,
    Adfs,
    B2C
}

/**
 * @hidden
 */
export abstract class Authority {

    private _canonicalAuthority: UrlString;
    private _canonicalAuthorityUrlComponents: IUri;
    private tenantDiscoveryResponse: ITenantDiscoveryResponse;
    protected networkInterface: INetworkModule;

    public abstract get authorityType(): AuthorityType;
    public abstract get isValidationEnabled(): boolean;

    /**
     * A URL that is the authority set by the developer
     */
    public get canonicalAuthority(): string {
        return this._canonicalAuthority.urlString;
    }

    public set canonicalAuthority(url: string) {
        this._canonicalAuthority = new UrlString(url);
        this._canonicalAuthorityUrlComponents = null;
    }

    public get canonicalAuthorityUrlComponents(): IUri {
        if (!this._canonicalAuthorityUrlComponents) {
            this._canonicalAuthorityUrlComponents = this._canonicalAuthority.getUrlComponents();
        }

        return this._canonicalAuthorityUrlComponents;
    }

    public get tenant(): string {
        return this._canonicalAuthorityUrlComponents.PathSegments[0];
    }

    public get authorizationEndpoint(): string {
        if(this.discoveryComplete()) {
            return this.tenantDiscoveryResponse.authorization_endpoint.replace("{tenant}", this.tenant);
        } else {
            throw ClientAuthError.createEndpointDiscoveryIncompleteError("Discovery incomplete.");
        }
    }

    public get tokenEndpoint(): string {
        if(this.discoveryComplete()) {
            return this.tenantDiscoveryResponse.token_endpoint.replace("{tenant}", this.tenant);
        } else {
            throw ClientAuthError.createEndpointDiscoveryIncompleteError("Discovery incomplete.");
        }
    }

    public get endSessionEndpoint(): string {
        if(this.discoveryComplete()) {
            return this.tenantDiscoveryResponse.end_session_endpoint.replace("{tenant}", this.tenant);
        } else {
            throw ClientAuthError.createEndpointDiscoveryIncompleteError("Discovery incomplete.");
        }
    }

    public get selfSignedJwtAudience(): string {
        if(this.discoveryComplete()) {
            return this.tenantDiscoveryResponse.issuer.replace("{tenant}", this.tenant);
        } else {
            throw ClientAuthError.createEndpointDiscoveryIncompleteError("Discovery incomplete.");
        }
    }

    protected get defaultOpenIdConfigurationEndpoint(): string {
        return `${this.canonicalAuthority}v2.0/.well-known/openid-configuration`;
    }

    constructor(authority: string, networkInterface: INetworkModule) {
        this.canonicalAuthority = authority;

        this._canonicalAuthority.validateAsUri();
        this.networkInterface = networkInterface;
    }

    discoveryComplete() {
        return !!this.tenantDiscoveryResponse;
    }

    private async discoverEndpoints(openIdConfigurationEndpoint: string): Promise<ITenantDiscoveryResponse> {
        return this.networkInterface.sendGetRequestAsync<ITenantDiscoveryResponse>(openIdConfigurationEndpoint);
    }

    public abstract async getOpenIdConfigurationAsync(): Promise<string>;

    public async resolveEndpointsAsync(): Promise<void> {
        const openIdConfigEndpoint = await this.getOpenIdConfigurationAsync();
        this.tenantDiscoveryResponse = await this.discoverEndpoints(openIdConfigEndpoint);
    }
}