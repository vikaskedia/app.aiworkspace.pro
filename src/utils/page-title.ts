// Page title utility for consistent tab titles across the application
// Format: [Component specific navigation] < [workspace-component-name] < [workspace name] < [App name]

import { setFavicon } from './favicon.js';

interface TitleParts {
  componentSpecific?: string; // e.g., "HF" (outline node), "Task Title (25 char)"
  componentName?: string; // e.g., "Outlines", "Tasks", "Dashboard"
  workspaceName?: string; // e.g., "Priorities"
  appName?: string | false; // e.g., "AI Workspace" or false to exclude
}

const APP_NAME = 'AI Workspace';

/**
 * Sets the page title using the hierarchical format
 * @param parts - Object containing the different parts of the title
 */
export function setPageTitle(parts: TitleParts): void {
  const titleParts: string[] = [];

  // Add parts in reverse order (since we display right-to-left with <)
  if (parts.appName !== false) {
    titleParts.push(parts.appName || APP_NAME);
  }
  
  if (parts.workspaceName) {
    titleParts.push(parts.workspaceName);
  }
  
  if (parts.componentName) {
    titleParts.push(parts.componentName);
  }
  
  if (parts.componentSpecific) {
    titleParts.push(parts.componentSpecific);
  }

  // Join with ' < ' and reverse to get the correct order
  const title = titleParts.reverse().join(' < ');
  document.title = title;
}

/**
 * Truncates text to specified length with ellipsis
 * @param text - Text to truncate
 * @param maxLength - Maximum length (default: 25)
 */
export function truncateText(text: string, maxLength: number = 25): string {
  //if (!text) return '';
  //if (text.length <= maxLength) return text;
  //return text.substring(0, maxLength - 1).trim() + '…';
  return text;
}

/**
 * Gets a clean text representation for breadcrumbs/titles
 * @param text - Raw text that might contain HTML or formatting
 */
export function getCleanText(text: string): string {
  if (!text) return '';
  // Remove HTML tags and normalize whitespace
  return text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Sets title for outline components with focused node
 */
export function setOutlineTitle(focusedNodeText?: string, workspaceName?: string): void {
  let componentSpecific: string | undefined = undefined;
  
  if (focusedNodeText) {
    const cleanText = getCleanText(focusedNodeText);
    componentSpecific = truncateText(cleanText, 25);
  }
  
  setPageTitle({
    componentSpecific,
    componentName: 'Outlines',
    workspaceName,
  });
  
  // Set outlines favicon
  setFavicon('outlines');
}

/**
 * Sets title for task components
 */
export function setTaskTitle(taskTitle?: string, workspaceName?: string, componentName?: string): void {
  let componentSpecific: string | undefined = undefined;
  
  if (taskTitle) {
    const cleanText = getCleanText(taskTitle);
    componentSpecific = truncateText(cleanText, 25);
  }
  
  setPageTitle({
    componentSpecific,
    componentName,
    workspaceName,
  });
  
  // Set task favicon
  setFavicon('task');
}

/**
 * Sets title for dashboard and other general components
 */
export function setComponentTitle(componentName: string, workspaceName?: string, specificItem?: string): void {
  let componentSpecific: string | undefined = undefined;
  
  if (specificItem) {
    const cleanText = getCleanText(specificItem);
    componentSpecific = truncateText(cleanText, 25);
  }
  
  setPageTitle({
    componentSpecific,
    componentName,
    workspaceName,
  });
  
  // Set favicon based on component type
  const faviconMap: Record<string, string> = {
    'AI Portfolio': 'spreadsheet',
    'All Tasks': 'task',
    'All Workspaces': 'dashboard',
    'All Goals': 'goals',
    'All Events': 'events',
    'All Files': 'files',
    'All Contacts': 'communication'
  };
  
  const faviconType = faviconMap[componentName] || 'default';
  setFavicon(faviconType);
}

/**
 * Sets title for workspace/workspace specific pages
 */
export function setWorkspaceTitle(componentName: string, workspaceName?: string): void {
  setPageTitle({
    componentName,
    workspaceName,
  });
  
  // Set favicon based on component type
  const faviconMap: Record<string, string> = {
    'Tasks': 'task',
    'Files': 'files',
    'Goals': 'goals',
    'Events': 'events',
    'Outlines': 'outlines',
    'AI Phone': 'phone',
    'AI Intake': 'communication',
    'AI Fax': 'communication',
    'AI Fund Analyst': 'dashboard',
    'Communications': 'communication',
    'Settings': 'settings',
    'Dashboard': 'dashboard'
  };
  
  const faviconType = faviconMap[componentName] || 'default';
  setFavicon(faviconType);
}