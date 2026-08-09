// src/credentials.ts
export { credentialAvailable, resolveCredential };
function resolveCredential(configuration, resolveSecret) {
  switch (configuration.credentialSource) {
    case "secret-storage": {
      if (configuration.secretId.length === 0) {
        throw new Error("请先在心迹设置中选择 API Key");
      }
      const value = resolveSecret(configuration.secretId);
      if (value === null || value.length === 0) {
        throw new Error("Secret Storage 中没有找到所选 API Key");
      }
      return value;
    }
    case "none":
      return "";
    default:
      throw new Error("请先在心迹设置中选择 API Key");
  }
}
function credentialAvailable(configuration, resolveSecret) {
  try {
    resolveCredential(configuration, resolveSecret);
    return true;
  } catch {
    return false;
  }
}
