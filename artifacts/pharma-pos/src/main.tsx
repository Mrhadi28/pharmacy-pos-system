import { createRoot } from "react-dom/client";
import { setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";
import { getApiOrigin } from "@/lib/api-base";

const apiOrigin = getApiOrigin();
if (apiOrigin) {
  setBaseUrl(apiOrigin);
}

createRoot(document.getElementById("root")!).render(<App />);
