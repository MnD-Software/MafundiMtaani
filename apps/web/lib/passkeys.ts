function decode(value: string): ArrayBuffer {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(normalized), (character) => character.charCodeAt(0)).buffer;
}

function encode(value: ArrayBuffer | null): string | null {
  if (!value) return null;
  let binary = "";
  new Uint8Array(value).forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function creationOptions(options: PublicKeyCredentialCreationOptionsJSON): PublicKeyCredentialCreationOptions {
  return { ...options, challenge: decode(options.challenge), user: { ...options.user, id: decode(options.user.id) }, excludeCredentials: options.excludeCredentials?.map((item) => ({ ...item, id: decode(item.id) })) } as PublicKeyCredentialCreationOptions;
}

export function requestOptions(options: PublicKeyCredentialRequestOptionsJSON): PublicKeyCredentialRequestOptions {
  return { ...options, challenge: decode(options.challenge), allowCredentials: options.allowCredentials?.map((item) => ({ ...item, id: decode(item.id) })) } as PublicKeyCredentialRequestOptions;
}

export function serializeCredential(credential: PublicKeyCredential) {
  const response = credential.response;
  return {
    id: credential.id, rawId: encode(credential.rawId), type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment,
    clientExtensionResults: credential.getClientExtensionResults(),
    response: response instanceof AuthenticatorAttestationResponse
      ? { clientDataJSON: encode(response.clientDataJSON), attestationObject: encode(response.attestationObject), transports: response.getTransports?.() || [] }
      : { clientDataJSON: encode(response.clientDataJSON), authenticatorData: encode((response as AuthenticatorAssertionResponse).authenticatorData), signature: encode((response as AuthenticatorAssertionResponse).signature), userHandle: encode((response as AuthenticatorAssertionResponse).userHandle) },
  };
}
