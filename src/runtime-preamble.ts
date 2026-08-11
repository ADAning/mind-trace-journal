import * as import_obsidian7 from "obsidian";
export { mindTraceDocument, mindTraceWindow, mindTraceWorkspaceDocument, showMindTraceNotice };

function mindTraceDocument(element = null) {
  return element?.ownerDocument ?? activeDocument;
}

function mindTraceWindow(element = null) {
  return (mindTraceDocument(element)?.defaultView ?? activeWindow) as Window & typeof window;
}

function mindTraceWorkspaceDocument(app) {
  const container = app.workspace.getMostRecentLeaf()?.view?.containerEl ?? null;
  return mindTraceDocument(container);
}

function showMindTraceNotice(message, timeout = 4e3) {
  const notice = new import_obsidian7.Notice(message, timeout);
  notice.messageEl?.classList.add("mind-trace-notice");
  return notice;
}
