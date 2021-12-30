import { ApiModel, ApiPackage } from "@microsoft/api-extractor-model";

const apiModel: ApiModel = new ApiModel();
const apiPackage: ApiPackage = apiModel.loadPackage("./temp/solid-three.api.json");

console.log(apiPackage.name);
for (const member of apiPackage.entryPoints) {
  for (var m of member.members) {
    console.log(m.displayName);
  }
}
