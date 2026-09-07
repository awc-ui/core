import { Routes } from "@angular/router";
import {
  HomeComponent,
  LibraryComponent,
  ProfileComponent,
  ProjectComponent,
  AssetComponent,
  NotFoundComponent,
} from "./screens";
import { EditorComponent } from "./editor";
export const routes: Routes = [
  { path: "", pathMatch: "full", component: HomeComponent },
  { path: "editor", component: EditorComponent },
  { path: "assets", component: LibraryComponent },
  { path: "profile", component: ProfileComponent },
  { path: "p/:slug", component: ProjectComponent },
  { path: "f/:fileId", component: EditorComponent },
  { path: "a/:assetId", component: AssetComponent },
  { path: "**", component: NotFoundComponent },
];
