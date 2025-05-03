// src/types/recorder.d.ts

export interface RecordingSettings {
  targetUrl: string;
  browser: Browser;
  language: ProgrammingLanguage;
  framework: TestingFramework;
  testType: TestType;
  aiEnabled: boolean;
  smartWaitEnabled: boolean;
}

export enum Browser {
  CHROME = 'chrome',
  FIREFOX = 'firefox',
  EDGE = 'edge',
  SAFARI = 'safari'
}

export enum ProgrammingLanguage {
  JAVA = 'java',
  TYPESCRIPT = 'typescript'
}

export enum TestingFramework {
  SELENIUM = 'selenium',
  PLAYWRIGHT = 'playwright'
}

export enum TestType {
  TESTNG = 'testng',
  BDD = 'bdd'
}

export enum ActionType {
  CLICK = 'click',
  TYPE = 'type',
  SELECT = 'select',
  ASSERT = 'assert',
  HOVER = 'hover',
  DRAG_DROP = 'dragDrop',
  RIGHT_CLICK = 'rightClick',
  DOUBLE_CLICK = 'doubleClick',
  SCROLL = 'scroll',
  WAIT = 'wait',
  CONDITION = 'condition',
  LOOP = 'loop',
  CUSTOM_CODE = 'customCode',
  NAVIGATE = 'navigate',
  PAGE_REFRESH = 'pageRefresh',
  SWITCH_TAB = 'switchTab',
  SCREENSHOT = 'screenshot',
  FILE_UPLOAD = 'fileUpload'
}

export interface ElementLocator {
  id?: string;
  xpath?: string;
  css?: string;
  name?: string;
  className?: string;
  linkText?: string;
  tagName?: string;
  aiGeneratedLocator?: string;
  locatorConfidence: number;
  alternativeLocators: string[];
}

export interface RecordedAction {
  id: string;
  type: ActionType;
  timestamp: number;
  target?: ElementLocator;
  value?: string;
  description: string;
  screenshot?: string;
  htmlSnapshot?: string;
  conditionalLogic?: ConditionalLogic;
  loopLogic?: LoopLogic;
  customCode?: string;
  pageInfo: PageInfo;
}

export interface ConditionalLogic {
  condition: string;
  ifActions: string[];
  elseActions: string[];
}

export interface LoopLogic {
  loopType: 'for' | 'while' | 'forEach';
  condition: string;
  loopActions: string[];
}

export interface PageInfo {
  title: string;
  url: string;
  domSnapshot?: string;
}

export interface RecordingSession {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  settings: RecordingSettings;
  actions: RecordedAction[];
  status: 'recording' | 'paused' | 'stopped';
  duration: number;
}

export interface GeneratedTest {
  id: string;
  name: string;
  sessionId: string;
  code: string;
  language: ProgrammingLanguage;
  framework: TestingFramework;
  testType: TestType;
  createdAt: number;
  updatedAt: number;
}

export interface RecorderState {
  currentSession: RecordingSession | null;
  recordedSessions: RecordingSession[];
  generatedTests: GeneratedTest[];
  isRecording: boolean;
  isPaused: boolean;
  currentUrl: string;
  error: string | null;
}

export interface IRecorderService {
  startRecording(settings: RecordingSettings): Promise<RecordingSession>;
  stopRecording(sessionId: string): Promise<RecordingSession>;
  pauseRecording(sessionId: string): Promise<RecordingSession>;
  resumeRecording(sessionId: string): Promise<RecordingSession>;
  addAction(sessionId: string, action: RecordedAction): Promise<RecordingSession>;
  generateTest(sessionId: string): Promise<GeneratedTest>;
  saveTest(test: GeneratedTest): Promise<boolean>;
  runTest(testId: string): Promise<boolean>;
}


// src/services/recordingService.ts

import { 
  RecordingSettings, 
  RecordingSession, 
  RecordedAction, 
  GeneratedTest, 
  IRecorderService,
  ActionType,
  ElementLocator
} from '../types/recorder';
import { v4 as uuidv4 } from 'uuid';
import { SmartLocatorService } from './SmartLocatorService';
import { AIElementRecognitionService } from './AIElementRecognitionService';

/**
 * Service responsible for managing the test recording process
 */
export class RecorderService implements IRecorderService {
  private sessions: Map<string, RecordingSession> = new Map();
  private tests: Map<string, GeneratedTest> = new Map();
  private smartLocatorService: SmartLocatorService;
  private aiRecognitionService: AIElementRecognitionService;
  private activeInjectionScripts: Map<string, any> = new Map();

  constructor() {
    this.smartLocatorService = new SmartLocatorService();
    this.aiRecognitionService = new AIElementRecognitionService();
  }

  /**
   * Starts a new recording session with the provided settings
   */
  public async startRecording(settings: RecordingSettings): Promise<RecordingSession> {
    try {
      // Create a new recording session
      const sessionId = uuidv4();
      const newSession: RecordingSession = {
        id: sessionId,
        name: `Recording ${new Date().toLocaleString()}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        settings,
        actions: [],
        status: 'recording',
        duration: 0
      };
      
      this.sessions.set(sessionId, newSession);
      
      // Inject the recorder script into the browser
      await this.injectRecorderScript(sessionId, settings);
      
      // Add initial navigation action
      const navigateAction: RecordedAction = {
        id: uuidv4(),
        type: ActionType.NAVIGATE,
        timestamp: Date.now(),
        description: `Navigate to ${settings.targetUrl}`,
        value: settings.targetUrl,
        pageInfo: {
          title: 'Initial Navigation',
          url: settings.targetUrl
        }
      };
      
      await this.addAction(sessionId, navigateAction);
      
      return newSession;
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw new Error(`Failed to start recording: ${error.message}`);
    }
  }

  /**
   * Stops the recording session and finalizes the recorded actions
   */
  public async stopRecording(sessionId: string): Promise<RecordingSession> {
    try {
      const session = this.sessions.get(sessionId);
      
      if (!session) {
        throw new Error(`Recording session with ID ${sessionId} not found`);
      }
      
      // Remove the injected script
      await this.removeRecorderScript(sessionId);
      
      // Update session status
      const updatedSession: RecordingSession = {
        ...session,
        status: 'stopped',
        updatedAt: Date.now(),
        duration: Date.now() - session.createdAt
      };
      
      this.sessions.set(sessionId, updatedSession);
      
      return updatedSession;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      throw new Error(`Failed to stop recording: ${error.message}`);
    }
  }

  /**
   * Pauses the current recording session
   */
  public async pauseRecording(sessionId: string): Promise<RecordingSession> {
    try {
      const session = this.sessions.get(sessionId);
      
      if (!session) {
        throw new Error(`Recording session with ID ${sessionId} not found`);
      }
      
      // Pause the recorder script
      await this.pauseRecorderScript(sessionId);
      
      // Update session status
      const updatedSession: RecordingSession = {
        ...session,
        status: 'paused',
        updatedAt: Date.now()
      };
      
      this.sessions.set(sessionId, updatedSession);
      
      return updatedSession;
    } catch (error) {
      console.error('Failed to pause recording:', error);
      throw new Error(`Failed to pause recording: ${error.message}`);
    }
  }

  /**
   * Resumes a paused recording session
   */
  public async resumeRecording(sessionId: string): Promise<RecordingSession> {
    try {
      const session = this.sessions.get(sessionId);
      
      if (!session) {
        throw new Error(`Recording session with ID ${sessionId} not found`);
      }
      
      // Resume the recorder script
      await this.resumeRecorderScript(sessionId);
      
      // Update session status
      const updatedSession: RecordingSession = {
        ...session,
        status: 'recording',
        updatedAt: Date.now()
      };
      
      this.sessions.set(sessionId, updatedSession);
      
      return updatedSession;
    } catch (error) {
      console.error('Failed to resume recording:', error);
      throw new Error(`Failed to resume recording: ${error.message}`);
    }
  }

  /**
   * Adds a new action to the recording session
   */
  public async addAction(sessionId: string, action: RecordedAction): Promise<RecordingSession> {
    try {
      const session = this.sessions.get(sessionId);
      
      if (!session) {
        throw new Error(`Recording session with ID ${sessionId} not found`);
      }
      
      // If AI features are enabled, enhance the element locators
      if (session.settings.aiEnabled && action.target) {
        action.target = await this.enhanceLocators(action.target, action.pageInfo);
      }
      
      // Implement smart wait strategy if enabled
      if (session.settings.smartWaitEnabled && this.shouldAddWaitAction(action, session.actions)) {
        const waitAction = this.createSmartWaitAction(action);
        session.actions.push(waitAction);
      }
      
      // Add the action to the session
      const updatedActions = [...session.actions, action];
      
      const updatedSession: RecordingSession = {
        ...session,
        actions: updatedActions,
        updatedAt: Date.now()
      };
      
      this.sessions.set(sessionId, updatedSession);
      
      return updatedSession;
    } catch (error) {
      console.error('Failed to add action:', error);
      throw new Error(`Failed to add action: ${error.message}`);
    }
  }

  /**
   * Generates test code from the recording session
   */
  public async generateTest(sessionId: string): Promise<GeneratedTest> {
    try {
      const session = this.sessions.get(sessionId);
      
      if (!session) {
        throw new Error(`Recording session with ID ${sessionId} not found`);
      }
      
      // Generate test code based on the settings and recorded actions
      let code = '';
      
      switch (session.settings.language) {
        case 'java':
          if (session.settings.framework === 'selenium') {
            if (session.settings.testType === 'testng') {
              code = await this.generateSeleniumJavaTestNG(session);
            } else {
              code = await this.generateSeleniumJavaBDD(session);
            }
          } else {
            if (session.settings.testType === 'testng') {
              code = await this.generatePlaywrightJavaTestNG(session);
            } else {
              code = await this.generatePlaywrightJavaBDD(session);
            }
          }
          break;
        
        case 'typescript':
          if (session.settings.framework === 'playwright') {
            if (session.settings.testType === 'testng') {
              code = await this.generatePlaywrightTypeScriptTestNG(session);
            } else {
              code = await this.generatePlaywrightTypeScriptBDD(session);
            }
          }
          break;
      }
      
      const testId = uuidv4();
      const generatedTest: GeneratedTest = {
        id: testId,
        name: `Test_${session.name.replace(/\s+/g, '_')}`,
        sessionId: session.id,
        code,
        language: session.settings.language,
        framework: session.settings.framework,
        testType: session.settings.testType,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      this.tests.set(testId, generatedTest);
      
      return generatedTest;
    } catch (error) {
      console.error('Failed to generate test:', error);
      throw new Error(`Failed to generate test: ${error.message}`);
    }
  }

  /**
   * Saves the generated test to the file system
   */
  public async saveTest(test: GeneratedTest): Promise<boolean> {
    try {
      // Save to local file system via the backend API
      // Actual implementation would call the backend
      console.log(`Saving test ${test.id} to file system`);
      return true;
    } catch (error) {
      console.error('Failed to save test:', error);
      throw new Error(`Failed to save test: ${error.message}`);
    }
  }

  /**
   * Executes the generated test
   */
  public async runTest(testId: string): Promise<boolean> {
    try {
      const test = this.tests.get(testId);
      
      if (!test) {
        throw new Error(`Test with ID ${testId} not found`);
      }
      
      // Execute the test via the backend API
      // Actual implementation would call the backend
      console.log(`Running test ${test.id}`);
      return true;
    } catch (error) {
      console.error('Failed to run test:', error);
      throw new Error(`Failed to run test: ${error.message}`);
    }
  }

  /**
   * PRIVATE METHODS
   */

  /**
   * Injects the recorder script into the browser
   */
  private async injectRecorderScript(sessionId: string, settings: RecordingSettings): Promise<void> {
    // Implementation would create a browser-specific script injector
    console.log(`Injecting recorder script for session ${sessionId} with settings:`, settings);
    
    // Create browser-specific recorder script
    const recorderScript = this.createBrowserSpecificRecorderScript(settings.browser);
    
    // Store the script reference for later removal
    this.activeInjectionScripts.set(sessionId, recorderScript);
  }

  /**
   * Removes the injected recorder script
   */
  private async removeRecorderScript(sessionId: string): Promise<void> {
    const script = this.activeInjectionScripts.get(sessionId);
    
    if (script) {
      // Implementation would remove the script from the browser
      console.log(`Removing recorder script for session ${sessionId}`);
      this.activeInjectionScripts.delete(sessionId);
    }
  }

  /**
   * Pauses the recorder script
   */
  private async pauseRecorderScript(sessionId: string): Promise<void> {
    const script = this.activeInjectionScripts.get(sessionId);
    
    if (script) {
      // Implementation would pause the script
      console.log(`Pausing recorder script for session ${sessionId}`);
    }
  }

  /**
   * Resumes the recorder script
   */
  private async resumeRecorderScript(sessionId: string): Promise<void> {
    const script = this.activeInjectionScripts.get(sessionId);
    
    if (script) {
      // Implementation would resume the script
      console.log(`Resuming recorder script for session ${sessionId}`);
    }
  }

  /**
   * Creates a browser-specific recorder script
   */
  private createBrowserSpecificRecorderScript(browser: string): any {
    // Implementation would create a browser-specific script
    switch (browser) {
      case 'chrome':
        return this.createChromeRecorderScript();
      case 'firefox':
        return this.createFirefoxRecorderScript();
      case 'edge':
        return this.createEdgeRecorderScript();
      case 'safari':
        return this.createSafariRecorderScript();
      default:
        return this.createChromeRecorderScript();
    }
  }

  /**
   * Creates a Chrome-specific recorder script
   */
  private createChromeRecorderScript(): any {
    // Implementation would create a Chrome-specific script
    return {
      // Chrome-specific script implementation
      type: 'chrome',
      handlers: {
        click: this.handleChromeClick,
        input: this.handleChromeInput,
        // Other event handlers
      }
    };
  }

  /**
   * Creates a Firefox-specific recorder script
   */
  private createFirefoxRecorderScript(): any {
    // Implementation would create a Firefox-specific script
    return {
      // Firefox-specific script implementation
      type: 'firefox',
      handlers: {
        click: this.handleFirefoxClick,
        input: this.handleFirefoxInput,
        // Other event handlers
      }
    };
  }

  /**
   * Creates an Edge-specific recorder script
   */
  private createEdgeRecorderScript(): any {
    // Implementation would create an Edge-specific script
    return {
      // Edge-specific script implementation
      type: 'edge',
      handlers: {
        click: this.handleEdgeClick,
        input: this.handleEdgeInput,
        // Other event handlers
      }
    };
  }

  /**
   * Creates a Safari-specific recorder script
   */
  private createSafariRecorderScript(): any {
    // Implementation would create a Safari-specific script
    return {
      // Safari-specific script implementation
      type: 'safari',
      handlers: {
        click: this.handleSafariClick,
        input: this.handleSafariInput,
        // Other event handlers
      }
    };
  }

  /**
   * Event handlers for Chrome
   */
  private handleChromeClick(event: any): void {
    // Implementation would handle Chrome click events
  }

  private handleChromeInput(event: any): void {
    // Implementation would handle Chrome input events
  }

  /**
   * Event handlers for Firefox
   */
  private handleFirefoxClick(event: any): void {
    // Implementation would handle Firefox click events
  }

  private handleFirefoxInput(event: any): void {
    // Implementation would handle Firefox input events
  }

  /**
   * Event handlers for Edge
   */
  private handleEdgeClick(event: any): void {
    // Implementation would handle Edge click events
  }

  private handleEdgeInput(event: any): void {
    // Implementation would handle Edge input events
  }

  /**
   * Event handlers for Safari
   */
  private handleSafariClick(event: any): void {
    // Implementation would handle Safari click events
  }

  private handleSafariInput(event: any): void {
    // Implementation would handle Safari input events
  }

  /**
   * Enhances element locators using AI
   */
  private async enhanceLocators(target: ElementLocator, pageInfo: any): Promise<ElementLocator> {
    try {
      // Use AI to enhance locators
      const enhancedLocator = await this.aiRecognitionService.generateSmartLocators(target, pageInfo);
      
      // Merge with original locator but prioritize AI-generated ones
      return {
        ...target,
        ...enhancedLocator,
        locatorConfidence: enhancedLocator.locatorConfidence || target.locatorConfidence,
        alternativeLocators: [
          ...(enhancedLocator.alternativeLocators || []),
          ...(target.alternativeLocators || [])
        ]
      };
    } catch (error) {
      console.error('Failed to enhance locators:', error);
      return target;
    }
  }

  /**
   * Determines if a wait action should be added before the current action
   */
  private shouldAddWaitAction(action: RecordedAction, existingActions: RecordedAction[]): boolean {
    // Smart wait strategy implementation
    // Add wait actions for user interactions that might need elements to be ready
    const actionTypesRequiringWait = [
      ActionType.CLICK,
      ActionType.TYPE,
      ActionType.SELECT,
      ActionType.DRAG_DROP
    ];
    
    return actionTypesRequiringWait.includes(action.type as ActionType);
  }

  /**
   * Creates a smart wait action
   */
  private createSmartWaitAction(targetAction: RecordedAction): RecordedAction {
    // Create a wait action based on the target action
    return {
      id: uuidv4(),
      type: ActionType.WAIT,
      timestamp: targetAction.timestamp - 1, // Just before the target action
      description: `Wait for element to be ready`,
      target: targetAction.target,
      pageInfo: targetAction.pageInfo
    };
  }

  /**
   * Code generation methods for different languages and frameworks
   */
  private async generateSeleniumJavaTestNG(session: RecordingSession): Promise<string> {
    // Implementation would generate Selenium Java TestNG code
    let code = '';
    
    // Add package and imports
    code += 'package com.cstestforge.tests;\n\n';
    code += 'import org.testng.annotations.Test;\n';
    code += 'import org.testng.annotations.BeforeMethod;\n';
    code += 'import org.testng.annotations.AfterMethod;\n';
    code += 'import org.openqa.selenium.WebDriver;\n';
    code += 'import org.openqa.selenium.By;\n';
    code += 'import org.openqa.selenium.WebElement;\n';
    code += 'import org.openqa.selenium.chrome.ChromeDriver;\n';
    code += 'import org.openqa.selenium.support.ui.ExpectedConditions;\n';
    code += 'import org.openqa.selenium.support.ui.WebDriverWait;\n';
    code += 'import java.time.Duration;\n\n';
    
    // Add class
    code += `public class ${session.name.replace(/\s+/g, '_')}_Test {\n\n`;
    
    // Add driver field
    code += '    private WebDriver driver;\n';
    code += '    private WebDriverWait wait;\n\n';
    
    // Add setup method
    code += '    @BeforeMethod\n';
    code += '    public void setUp() {\n';
    code += '        driver = new ChromeDriver();\n';
    code += '        driver.manage().window().maximize();\n';
    code += '        wait = new WebDriverWait(driver, Duration.ofSeconds(10));\n';
    code += '    }\n\n';
    
    // Add test method
    code += '    @Test\n';
    code += `    public void ${session.name.replace(/\s+/g, '_')}_test() {\n`;
    
    // Add actions
    session.actions.forEach(action => {
      switch (action.type) {
        case ActionType.NAVIGATE:
          code += `        // ${action.description}\n`;
          code += `        driver.get("${action.value}");\n\n`;
          break;
        
        case ActionType.CLICK:
          code += `        // ${action.description}\n`;
          if (action.target?.id) {
            code += `        WebElement element = wait.until(ExpectedConditions.elementToBeClickable(By.id("${action.target.id}")));\n`;
          } else if (action.target?.xpath) {
            code += `        WebElement element = wait.until(ExpectedConditions.elementToBeClickable(By.xpath("${action.target.xpath}")));\n`;
          } else if (action.target?.css) {
            code += `        WebElement element = wait.until(ExpectedConditions.elementToBeClickable(By.cssSelector("${action.target.css}")));\n`;
          } else if (action.target?.aiGeneratedLocator) {
            code += `        WebElement element = wait.until(ExpectedConditions.elementToBeClickable(By.xpath("${action.target.aiGeneratedLocator}")));\n`;
          }
          code += '        element.click();\n\n';
          break;
        
        case ActionType.TYPE:
          code += `        // ${action.description}\n`;
          if (action.target?.id) {
            code += `        WebElement element = wait.until(ExpectedConditions.visibilityOfElementLocated(By.id("${action.target.id}")));\n`;
          } else if (action.target?.xpath) {
            code += `        WebElement element = wait.until(ExpectedConditions.visibilityOfElementLocated(By.xpath("${action.target.xpath}")));\n`;
          } else if (action.target?.css) {
            code += `        WebElement element = wait.until(ExpectedConditions.visibilityOfElementLocated(By.cssSelector("${action.target.css}")));\n`;
          } else if (action.target?.aiGeneratedLocator) {
            code += `        WebElement element = wait.until(ExpectedConditions.visibilityOfElementLocated(By.xpath("${action.target.aiGeneratedLocator}")));\n`;
          }
          code += '        element.clear();\n';
          code += `        element.sendKeys("${action.value}");\n\n`;
          break;
        
        case ActionType.WAIT:
          code += `        // ${action.description}\n`;
          code += '        try {\n';
          code += '            Thread.sleep(2000);\n';
          code += '        } catch (InterruptedException e) {\n';
          code += '            e.printStackTrace();\n';
          code += '        }\n\n';
          break;
        
        // Add more action types here
      }
    });
    
    // Close test method
    code += '    }\n\n';
    
    // Add teardown method
    code += '    @AfterMethod\n';
    code += '    public void tearDown() {\n';
    code += '        if (driver != null) {\n';
    code += '            driver.quit();\n';
    code += '        }\n';
    code += '    }\n';
    
    // Close class
    code += '}\n';
    
    return code;
  }

  private async generateSeleniumJavaBDD(session: RecordingSession): Promise<string> {
    // Implementation would generate Selenium Java BDD code
    // This is a placeholder implementation
    return 'Selenium Java BDD code generation not implemented yet';
  }

  private async generatePlaywrightJavaTestNG(session: RecordingSession): Promise<string> {
    // Implementation would generate Playwright Java TestNG code
    // This is a placeholder implementation
    return 'Playwright Java TestNG code generation not implemented yet';
  }

  private async generatePlaywrightJavaBDD(session: RecordingSession): Promise<string> {
    // Implementation would generate Playwright Java BDD code
    // This is a placeholder implementation
    return 'Playwright Java BDD code generation not implemented yet';
  }

  private async generatePlaywrightTypeScriptTestNG(session: RecordingSession): Promise<string> {
    // Implementation would generate Playwright TypeScript TestNG-like code
    let code = '';
    
    // Add imports
    code += 'import { test, expect } from \'@playwright/test\';\n\n';
    
    // Add test
    code += `test('${session.name}', async ({ page }) => {\n`;
    
    // Add actions
    session.actions.forEach(action => {
      switch (action.type) {
        case ActionType.NAVIGATE:
          code += `  // ${action.description}\n`;
          code += `  await page.goto('${action.value}');\n\n`;
          break;
        
        case ActionType.CLICK:
          code += `  // ${action.description}\n`;
          if (action.target?.id) {
            code += `  await page.click('#${action.target.id}');\n\n`;
          } else if (action.target?.xpath) {
            code += `  await page.click('xpath=${action.target.xpath}');\n\n`;
          } else if (action.target?.css) {
            code += `  await page.click('${action.target.css}');\n\n`;
          } else if (action.target?.aiGeneratedLocator) {
            code += `  await page.click('xpath=${action.target.aiGeneratedLocator}');\n\n`;
          }
          break;
        
        case ActionType.TYPE:
          code += `  // ${action.description}\n`;
          if (action.target?.id) {
            code += `  await page.fill('#${action.target.id}', '${action.value}');\n\n`;
          } else if (action.target?.xpath) {
            code += `  await page.fill('xpath=${action.target.xpath}', '${action.value}');\n\n`;
          } else if (action.target?.css) {
            code += `  await page.fill('${action.target.css}', '${action.value}');\n\n`;
          } else if (action.target?.aiGeneratedLocator) {
            code += `  await page.fill('xpath=${action.target.aiGeneratedLocator}', '${action.value}');\n\n`;
          }
          break;
        
        case ActionType.WAIT:
          code += `  // ${action.description}\n`;
          code += '  await page.waitForTimeout(2000);\n\n';
          break;
        
        // Add more action types here
      }
    });
    
    // Close test
    code += '});\n';
    
    return code;
  }

  private async generatePlaywrightTypeScriptBDD(session: RecordingSession): Promise<string> {
    // Implementation would generate Playwright TypeScript BDD code
    // This is a placeholder implementation
    return 'Playwright TypeScript BDD code generation not implemented yet';
  }
}

/**
 * Service for AI-based element recognition
 */
class AIElementRecognitionService {
  /**
   * Generates smart locators using AI
   */
  public async generateSmartLocators(target: ElementLocator, pageInfo: any): Promise<ElementLocator> {
    // AI-based locator generation would be implemented here
    // This is a placeholder implementation
    
    const aiLocator = `//div[@id='ai-generated-id' and contains(@class, 'ai-generated-class') and text()='${pageInfo.title}']`;
    
    return {
      ...target,
      aiGeneratedLocator: aiLocator,
      locatorConfidence: 0.95,
      alternativeLocators: [
        `//div[@id='alternative-id-1']`,
        `//div[@class='alternative-class-1']`,
        `//div[contains(text(), 'Alternative text 1')]`
      ]
    };
  }
}

/**
 * Service for smart locator generation
 */
class SmartLocatorService {
  /**
   * Generates smart locators
   */
  public async generateSmartLocators(element: any, pageContext: any): Promise<string[]> {
    // Smart locator generation would be implemented here
    // This is a placeholder implementation
    return [
      `//div[@id='smart-id-1']`,
      `//div[@class='smart-class-1']`,
      `//div[contains(text(), 'Smart text 1')]`
    ];
  }
}


// src/components/recorder/TestRecorder.tsx

import React, { useState, useEffect, useRef } from 'react';
import { 
  RecordingSettings, 
  Browser, 
  ProgrammingLanguage, 
  TestingFramework, 
  TestType,
  RecordingSession,
  RecordedAction,
  ActionType
} from '../../types/recorder';
import { RecorderService } from '../../services/recordingService';
import RecorderControls from './RecorderControls';
import BrowserFrame from './BrowserFrame';
import ActionToolbar from './ActionToolbar';
import StepsList from './StepsList';
import RecorderSettings from './RecorderSettings';
import ElementHighlighter from './ElementHighlighter';

import './TestRecorder.css';

interface TestRecorderProps {
  onTestGenerated: (test: any) => void;
}

const TestRecorder: React.FC<TestRecorderProps> = ({ onTestGenerated }) => {
  // State for recorder settings
  const [settings, setSettings] = useState<RecordingSettings>({
    targetUrl: '',
    browser: Browser.CHROME,
    language: ProgrammingLanguage.JAVA,
    framework: TestingFramework.SELENIUM,
    testType: TestType.TESTNG,
    aiEnabled: true,
    smartWaitEnabled: true
  });

  // State for recording status
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [currentSession, setCurrentSession] = useState<RecordingSession | null>(null);
  const [recordedActions, setRecordedActions] = useState<RecordedAction[]>([]);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Refs for service and timer
  const recorderServiceRef = useRef<RecorderService>(new RecorderService());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize browser frame communication
  useEffect(() => {
    // Set up message listener for actions from the browser frame
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'RECORDED_ACTION' && currentSession) {
        handleRecordedAction(event.data.action);
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [currentSession]);

  // Timer for recording duration
  useEffect(() => {
    if (isRecording && !isPaused) {
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording, isPaused]);

  // Convert seconds to formatted time
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Handle settings changes
  const handleSettingsChange = (newSettings: RecordingSettings) => {
    setSettings(newSettings);
  };

  // Handle start recording
  const handleStartRecording = async () => {
    try {
      if (!settings.targetUrl) {
        setErrorMessage('Target URL is required');
        return;
      }

      setErrorMessage('');
      const service = recorderServiceRef.current;
      const session = await service.startRecording(settings);
      
      setCurrentSession(session);
      setRecordedActions(session.actions);
      setIsRecording(true);
      setIsPaused(false);
      setRecordingDuration(0);
    } catch (error) {
      setErrorMessage(`Failed to start recording: ${error.message}`);
    }
  };

  // Handle stop recording
  const handleStopRecording = async () => {
    try {
      if (!currentSession) {
        return;
      }

      const service = recorderServiceRef.current;
      const updatedSession = await service.stopRecording(currentSession.id);
      
      setCurrentSession(updatedSession);
      setRecordedActions(updatedSession.actions);
      setIsRecording(false);
      setIsPaused(false);

      // Generate test code
      const generatedTest = await service.generateTest(updatedSession.id);
      onTestGenerated(generatedTest);
    } catch (error) {
      setErrorMessage(`Failed to stop recording: ${error.message}`);
    }
  };

  // Handle pause recording
  const handlePauseRecording = async () => {
    try {
      if (!currentSession) {
        return;
      }

      const service = recorderServiceRef.current;
      const updatedSession = await service.pauseRecording(currentSession.id);
      
      setCurrentSession(updatedSession);
      setIsPaused(true);
    } catch (error) {
      setErrorMessage(`Failed to pause recording: ${error.message}`);
    }
  };

  // Handle resume recording
  const handleResumeRecording = async () => {
    try {
      if (!currentSession) {
        return;
      }

      const service = recorderServiceRef.current;
      const updatedSession = await service.resumeRecording(currentSession.id);
      
      setCurrentSession(updatedSession);
      setIsPaused(false);
    } catch (error) {
      setErrorMessage(`Failed to resume recording: ${error.message}`);
    }
  };

  // Handle recorded action
  const handleRecordedAction = async (action: RecordedAction) => {
    try {
      if (!currentSession) {
        return;
      }

      const service = recorderServiceRef.current;
      const updatedSession = await service.addAction(currentSession.id, action);
      
      setCurrentSession(updatedSession);
      setRecordedActions(updatedSession.actions);
    } catch (error) {
      setErrorMessage(`Failed to record action: ${error.message}`);
    }
  };

  // Handle manual action insertion
  const handleInsertAction = async (actionType: ActionType) => {
    if (!currentSession || !isRecording) {
      return;
    }

    let action: RecordedAction;

    switch (actionType) {
      case ActionType.CONDITION:
        action = createConditionAction();
        break;
      case ActionType.LOOP:
        action = createLoopAction();
        break;
      case ActionType.CUSTOM_CODE:
        action = createCustomCodeAction();
        break;
      case ActionType.WAIT:
        action = createWaitAction();
        break;
      default:
        return;
    }

    await handleRecordedAction(action);
  };

  // Create conditional action
  const createConditionAction = (): RecordedAction => {
    return {
      id: crypto.randomUUID(),
      type: ActionType.CONDITION,
      timestamp: Date.now(),
      description: 'Conditional logic',
      conditionalLogic: {
        condition: 'element.isDisplayed()',
        ifActions: [],
        elseActions: []
      },
      pageInfo: {
        title: currentSession?.settings.targetUrl || '',
        url: currentSession?.settings.targetUrl || ''
      }
    };
  };

  // Create loop action
  const createLoopAction = (): RecordedAction => {
    return {
      id: crypto.randomUUID(),
      type: ActionType.LOOP,
      timestamp: Date.now(),
      description: 'Loop logic',
      loopLogic: {
        loopType: 'for',
        condition: 'int i = 0; i < 5; i++',
        loopActions: []
      },
      pageInfo: {
        title: currentSession?.settings.targetUrl || '',
        url: currentSession?.settings.targetUrl || ''
      }
    };
  };

  // Create custom code action
  const createCustomCodeAction = (): RecordedAction => {
    return {
      id: crypto.randomUUID(),
      type: ActionType.CUSTOM_CODE,
      timestamp: Date.now(),
      description: 'Custom code',
      customCode: '// Add your custom code here',
      pageInfo: {
        title: currentSession?.settings.targetUrl || '',
        url: currentSession?.settings.targetUrl || ''
      }
    };
  };

  // Create wait action
  const createWaitAction = (): RecordedAction => {
    return {
      id: crypto.randomUUID(),
      type: ActionType.WAIT,
      timestamp: Date.now(),
      description: 'Wait',
      value: '5000', // Wait for 5 seconds
      pageInfo: {
        title: currentSession?.settings.targetUrl || '',
        url: currentSession?.settings.targetUrl || ''
      }
    };
  };

  // Delete recorded action
  const handleDeleteAction = (actionId: string) => {
    if (!currentSession) {
      return;
    }

    const updatedActions = recordedActions.filter(action => action.id !== actionId);
    setRecordedActions(updatedActions);

    // Update session (would normally call service)
    setCurrentSession({
      ...currentSession,
      actions: updatedActions
    });
  };

  // Edit recorded action
  const handleEditAction = (actionId: string, updatedAction: RecordedAction) => {
    if (!currentSession) {
      return;
    }

    const updatedActions = recordedActions.map(action => 
      action.id === actionId ? updatedAction : action
    );
    
    setRecordedActions(updatedActions);

    // Update session (would normally call service)
    setCurrentSession({
      ...currentSession,
      actions: updatedActions
    });
  };

  return (
    <div className="test-recorder">
      <div className="test-recorder-header">
        <h2>CSTestForge Test Recorder</h2>
        <div className="recording-status">
          {isRecording && (
            <>
              <div className={`recording-indicator ${isPaused ? 'paused' : 'active'}`}></div>
              <span className="recording-time">{formatTime(recordingDuration)}</span>
            </>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="error-message">
          {errorMessage}
        </div>
      )}

      <div className="test-recorder-settings">
        <RecorderSettings 
          settings={settings} 
          onSettingsChange={handleSettingsChange}
          disabled={isRecording}
        />
      </div>

      <div className="test-recorder-controls">
        <RecorderControls
          isRecording={isRecording}
          isPaused={isPaused}
          onStart={handleStartRecording}
          onStop={handleStopRecording}
          onPause={handlePauseRecording}
          onResume={handleResumeRecording}
        />
      </div>

      <div className="test-recorder-workspace">
        <div className="test-recorder-browser-container">
          <BrowserFrame targetUrl={settings.targetUrl} isRecording={isRecording} />
          {isRecording && <ElementHighlighter />}
          {isRecording && (
            <ActionToolbar 
              onInsertAction={handleInsertAction} 
              disabled={isPaused}
            />
          )}
        </div>

        <div className="test-recorder-steps-container">
          <StepsList 
            actions={recordedActions} 
            onEditAction={handleEditAction}
            onDeleteAction={handleDeleteAction}
          />
        </div>
      </div>
    </div>
  );
};

export default TestRecorder;


// src/components/recorder/RecorderControls.tsx

import React from 'react';
import './RecorderControls.css';

interface RecorderControlsProps {
  isRecording: boolean;
  isPaused: boolean;
  onStart: () => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
}

const RecorderControls: React.FC<RecorderControlsProps> = ({
  isRecording,
  isPaused,
  onStart,
  onStop,
  onPause,
  onResume
}) => {
  return (
    <div className="recorder-controls">
      {!isRecording ? (
        <button 
          className="control-button start-button"
          onClick={onStart}
          title="Start recording"
        >
          <svg viewBox="0 0 24 24" width="24" height="24">
            <circle cx="12" cy="12" r="10" fill="#d32f2f" />
          </svg>
          <span>Start Recording</span>
        </button>
      ) : (
        <>
          {!isPaused ? (
            <button 
              className="control-button pause-button"
              onClick={onPause}
              title="Pause recording"
            >
              <svg viewBox="0 0 24 24" width="24" height="24">
                <rect x="6" y="4" width="4" height="16" fill="#333" />
                <rect x="14" y="4" width="4" height="16" fill="#333" />
              </svg>
              <span>Pause</span>
            </button>
          ) : (
            <button 
              className="control-button resume-button"
              onClick={onResume}
              title="Resume recording"
            >
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path d="M8,5 L8,19 L19,12 L8,5" fill="#333" />
              </svg>
              <span>Resume</span>
            </button>
          )}
          
          <button 
            className="control-button stop-button"
            onClick={onStop}
            title="Stop recording"
          >
            <svg viewBox="0 0 24 24" width="24" height="24">
              <rect x="5" y="5" width="14" height="14" fill="#333" />
            </svg>
            <span>Stop</span>
          </button>
        </>
      )}
    </div>
  );
};

export default RecorderControls;


// src/components/recorder/RecorderSettings.tsx

import React, { useState, useEffect } from 'react';
import { 
  RecordingSettings, 
  Browser, 
  ProgrammingLanguage, 
  TestingFramework, 
  TestType 
} from '../../types/recorder';
import './RecorderSettings.css';

interface RecorderSettingsProps {
  settings: RecordingSettings;
  onSettingsChange: (settings: RecordingSettings) => void;
  disabled: boolean;
}

const RecorderSettings: React.FC<RecorderSettingsProps> = ({
  settings,
  onSettingsChange,
  disabled
}) => {
  const [localSettings, setLocalSettings] = useState<RecordingSettings>(settings);
  
  // Update local settings when props change
  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  // Handle changes to the settings form
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox';
    const newValue = isCheckbox 
      ? (e.target as HTMLInputElement).checked 
      : value;
    
    const updatedSettings = {
      ...localSettings,
      [name]: isCheckbox ? newValue : 
        name === 'browser' ? value as Browser :
        name === 'language' ? value as ProgrammingLanguage :
        name === 'framework' ? value as TestingFramework :
        name === 'testType' ? value as TestType :
        value
    };
    
    setLocalSettings(updatedSettings);
    onSettingsChange(updatedSettings);
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSettingsChange(localSettings);
  };

  // Filter test frameworks based on language selection
  const getAvailableFrameworks = () => {
    switch (localSettings.language) {
      case ProgrammingLanguage.JAVA:
        return [
          { value: TestingFramework.SELENIUM, label: 'Selenium' },
          { value: TestingFramework.PLAYWRIGHT, label: 'Playwright' }
        ];
      case ProgrammingLanguage.TYPESCRIPT:
        return [
          { value: TestingFramework.PLAYWRIGHT, label: 'Playwright' }
        ];
      default:
        return [
          { value: TestingFramework.SELENIUM, label: 'Selenium' },
          { value: TestingFramework.PLAYWRIGHT, label: 'Playwright' }
        ];
    }
  };

  return (
    <form className="recorder-settings-form" onSubmit={handleSubmit}>
      <div className="settings-row">
        <div className="settings-field">
          <label htmlFor="targetUrl">Target URL</label>
          <input
            type="url"
            id="targetUrl"
            name="targetUrl"
            value={localSettings.targetUrl}
            onChange={handleChange}
            placeholder="https://example.com"
            required
            disabled={disabled}
          />
        </div>
        
        <div className="settings-field">
          <label htmlFor="browser">Browser</label>
          <select
            id="browser"
            name="browser"
            value={localSettings.browser}
            onChange={handleChange}
            disabled={disabled}
          >
            <option value={Browser.CHROME}>Chrome</option>
            <option value={Browser.FIREFOX}>Firefox</option>
            <option value={Browser.EDGE}>Edge</option>
            <option value={Browser.SAFARI}>Safari</option>
          </select>
        </div>
      </div>
      
      <div className="settings-row">
        <div className="settings-field">
          <label htmlFor="language">Programming Language</label>
          <select
            id="language"
            name="language"
            value={localSettings.language}
            onChange={handleChange}
            disabled={disabled}
          >
            <option value={ProgrammingLanguage.JAVA}>Java</option>
            <option value={ProgrammingLanguage.TYPESCRIPT}>TypeScript</option>
          </select>
        </div>
        
        <div className="settings-field">
          <label htmlFor="framework">Testing Framework</label>
          <select
            id="framework"
            name="framework"
            value={localSettings.framework}
            onChange={handleChange}
            disabled={disabled}
          >
            {getAvailableFrameworks().map(framework => (
              <option key={framework.value} value={framework.value}>
                {framework.label}
              </option>
            ))}
          </select>
        </div>
        
        <div className="settings-field">
          <label htmlFor="testType">Test Type</label>
          <select
            id="testType"
            name="testType"
            value={localSettings.testType}
            onChange={handleChange}
            disabled={disabled}
          >
            <option value={TestType.TESTNG}>TestNG</option>
            <option value={TestType.BDD}>BDD</option>
          </select>
        </div>
      </div>
      
      <div className="settings-row">
        <div className="settings-field settings-checkbox">
          <input
            type="checkbox"
            id="aiEnabled"
            name="aiEnabled"
            checked={localSettings.aiEnabled}
            onChange={handleChange}
            disabled={disabled}
          />
          <label htmlFor="aiEnabled">Enable AI features</label>
        </div>
        
        <div className="settings-field settings-checkbox">
          <input
            type="checkbox"
            id="smartWaitEnabled"
            name="smartWaitEnabled"
            checked={localSettings.smartWaitEnabled}
            onChange={handleChange}
            disabled={disabled}
          />
          <label htmlFor="smartWaitEnabled">Enable smart wait strategy</label>
        </div>
      </div>
    </form>
  );
};

export default RecorderSettings;


// cstestforge/frontend/src/components/recorder/StepsList.tsx

import React, { useState } from 'react';
import { RecordedAction, ActionType } from '../../types/recorder';
import './StepsList.css';

interface StepsListProps {
  actions: RecordedAction[];
  onEditAction: (actionId: string, updatedAction: RecordedAction) => void;
  onDeleteAction: (actionId: string) => void;
}

const StepsList: React.FC<StepsListProps> = ({
  actions,
  onEditAction,
  onDeleteAction
}) => {
  const [expandedAction, setExpandedAction] = useState<string | null>(null);
  const [editingAction, setEditingAction] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<RecordedAction>>({});

  // Toggle action expansion
  const toggleExpand = (actionId: string) => {
    setExpandedAction(prevId => prevId === actionId ? null : actionId);
  };

  // Start editing an action
  const startEditing = (action: RecordedAction) => {
    setEditingAction(action.id);
    setEditForm({ ...action });
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingAction(null);
    setEditForm({});
  };

  // Save edited action
  const saveEditing = () => {
    if (editingAction && editForm.id) {
      onEditAction(editingAction, editForm as RecordedAction);
      setEditingAction(null);
      setEditForm({});
    }
  };

  // Handle edit form changes
  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    setEditForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle nested property changes
  const handleNestedChange = (objectName: string, propertyName: string, value: any) => {
    setEditForm(prev => ({
      ...prev,
      [objectName]: {
        ...prev[objectName as keyof RecordedAction],
        [propertyName]: value
      }
    }));
  };

  // Get action display name based on type
  const getActionDisplayName = (type: ActionType): string => {
    switch (type) {
      case ActionType.CLICK:
        return 'Click';
      case ActionType.TYPE:
        return 'Type';
      case ActionType.SELECT:
        return 'Select';
      case ActionType.ASSERT:
        return 'Assert';
      case ActionType.HOVER:
        return 'Hover';
      case ActionType.DRAG_DROP:
        return 'Drag/Drop';
      case ActionType.RIGHT_CLICK:
        return 'Right Click';
      case ActionType.DOUBLE_CLICK:
        return 'Double Click';
      case ActionType.SCROLL:
        return 'Scroll';
      case ActionType.WAIT:
        return 'Wait';
      case ActionType.CONDITION:
        return 'Condition';
      case ActionType.LOOP:
        return 'Loop';
      case ActionType.CUSTOM_CODE:
        return 'Custom Code';
      case ActionType.NAVIGATE:
        return 'Navigate';
      case ActionType.PAGE_REFRESH:
        return 'Refresh Page';
      case ActionType.SWITCH_TAB:
        return 'Switch Tab';
      case ActionType.SCREENSHOT:
        return 'Screenshot';
      case ActionType.FILE_UPLOAD:
        return 'File Upload';
      default:
        return 'Unknown Action';
    }
  };

  // Format timestamp to readable time
  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  // Render edit form based on action type
  const renderEditForm = (action: RecordedAction) => {
    return (
      <div className="edit-form">
        <div className="form-group">
          <label>Description</label>
          <input
            type="text"
            name="description"
            value={editForm.description || ''}
            onChange={handleEditChange}
          />
        </div>
        
        {action.type === ActionType.CLICK && action.target && (
          <div className="form-group">
            <label>Target Selector</label>
            <select 
              name="targetType" 
              value={
                editForm.target?.id ? 'id' :
                editForm.target?.xpath ? 'xpath' :
                editForm.target?.css ? 'css' :
                editForm.target?.aiGeneratedLocator ? 'ai' :
                'xpath'
              }
              onChange={(e) => {
                // Clear all locators first
                const newTarget = { 
                  ...editForm.target, 
                  id: undefined,
                  xpath: undefined,
                  css: undefined,
                  aiGeneratedLocator: undefined,
                  locatorConfidence: editForm.target?.locatorConfidence || 0,
                  alternativeLocators: editForm.target?.alternativeLocators || []
                };
                
                // Set the selected locator type
                const type = e.target.value;
                if (type === 'id') newTarget.id = '';
                if (type === 'xpath') newTarget.xpath = '';
                if (type === 'css') newTarget.css = '';
                if (type === 'ai') newTarget.aiGeneratedLocator = '';
                
                setEditForm(prev => ({
                  ...prev,
                  target: newTarget
                }));
              }}
            >
              <option value="id">ID</option>
              <option value="xpath">XPath</option>
              <option value="css">CSS</option>
              <option value="ai">AI Generated</option>
            </select>
            
            {editForm.target?.id !== undefined && (
              <input
                type="text"
                value={editForm.target.id || ''}
                onChange={(e) => handleNestedChange('target', 'id', e.target.value)}
                placeholder="Element ID"
              />
            )}
            
            {editForm.target?.xpath !== undefined && (
              <input
                type="text"
                value={editForm.target.xpath || ''}
                onChange={(e) => handleNestedChange('target', 'xpath', e.target.value)}
                placeholder="XPath"
              />
            )}
            
            {editForm.target?.css !== undefined && (
              <input
                type="text"
                value={editForm.target.css || ''}
                onChange={(e) => handleNestedChange('target', 'css', e.target.value)}
                placeholder="CSS Selector"
              />
            )}
            
            {editForm.target?.aiGeneratedLocator !== undefined && (
              <input
                type="text"
                value={editForm.target.aiGeneratedLocator || ''}
                onChange={(e) => handleNestedChange('target', 'aiGeneratedLocator', e.target.value)}
                placeholder="AI Generated Locator"
              />
            )}
          </div>
        )}
        
        {action.type === ActionType.TYPE && (
          <>
            <div className="form-group">
              <label>Target Selector</label>
              <select 
                name="targetType" 
                value={
                  editForm.target?.id ? 'id' :
                  editForm.target?.xpath ? 'xpath' :
                  editForm.target?.css ? 'css' :
                  editForm.target?.aiGeneratedLocator ? 'ai' :
                  'xpath'
                }
                onChange={(e) => {
                  // Clear all locators first
                  const newTarget = { 
                    ...editForm.target, 
                    id: undefined,
                    xpath: undefined,
                    css: undefined,
                    aiGeneratedLocator: undefined,
                    locatorConfidence: editForm.target?.locatorConfidence || 0,
                    alternativeLocators: editForm.target?.alternativeLocators || []
                  };
                  
                  // Set the selected locator type
                  const type = e.target.value;
                  if (type === 'id') newTarget.id = '';
                  if (type === 'xpath') newTarget.xpath = '';
                  if (type === 'css') newTarget.css = '';
                  if (type === 'ai') newTarget.aiGeneratedLocator = '';
                  
                  setEditForm(prev => ({
                    ...prev,
                    target: newTarget
                  }));
                }}
              >
                <option value="id">ID</option>
                <option value="xpath">XPath</option>
                <option value="css">CSS</option>
                <option value="ai">AI Generated</option>
              </select>
              
              {editForm.target?.id !== undefined && (
                <input
                  type="text"
                  value={editForm.target.id || ''}
                  onChange={(e) => handleNestedChange('target', 'id', e.target.value)}
                  placeholder="Element ID"
                />
              )}
              
              {editForm.target?.xpath !== undefined && (
                <input
                  type="text"
                  value={editForm.target.xpath || ''}
                  onChange={(e) => handleNestedChange('target', 'xpath', e.target.value)}
                  placeholder="XPath"
                />
              )}
              
              {editForm.target?.css !== undefined && (
                <input
                  type="text"
                  value={editForm.target.css || ''}
                  onChange={(e) => handleNestedChange('target', 'css', e.target.value)}
                  placeholder="CSS Selector"
                />
              )}
              
              {editForm.target?.aiGeneratedLocator !== undefined && (
                <input
                  type="text"
                  value={editForm.target.aiGeneratedLocator || ''}
                  onChange={(e) => handleNestedChange('target', 'aiGeneratedLocator', e.target.value)}
                  placeholder="AI Generated Locator"
                />
              )}
            </div>
            
            <div className="form-group">
              <label>Text Value</label>
              <input
                type="text"
                name="value"
                value={editForm.value || ''}
                onChange={handleEditChange}
                placeholder="Text to type"
              />
            </div>
          </>
        )}
        
        {action.type === ActionType.WAIT && (
          <div className="form-group">
            <label>Wait Duration (ms)</label>
            <input
              type="number"
              name="value"
              value={editForm.value || ''}
              onChange={handleEditChange}
              placeholder="Wait duration in milliseconds"
            />
          </div>
        )}
        
        {action.type === ActionType.CUSTOM_CODE && (
          <div className="form-group">
            <label>Custom Code</label>
            <textarea
              name="customCode"
              value={editForm.customCode || ''}
              onChange={handleEditChange}
              rows={5}
              placeholder="// Add your custom code here"
            />
          </div>
        )}
        
        {action.type === ActionType.CONDITION && (
          <div className="form-group">
            <label>Condition</label>
            <input
              type="text"
              value={editForm.conditionalLogic?.condition || ''}
              onChange={(e) => handleNestedChange('conditionalLogic', 'condition', e.target.value)}
              placeholder="Condition expression"
            />
          </div>
        )}
        
        {action.type === ActionType.LOOP && (
          <>
            <div className="form-group">
              <label>Loop Type</label>
              <select
                value={editForm.loopLogic?.loopType || 'for'}
                onChange={(e) => handleNestedChange('loopLogic', 'loopType', e.target.value)}
              >
                <option value="for">For</option>
                <option value="while">While</option>
                <option value="forEach">For Each</option>
              </select>
            </div>
            
            <div className="form-group">
              <label>Loop Condition</label>
              <input
                type="text"
                value={editForm.loopLogic?.condition || ''}
                onChange={(e) => handleNestedChange('loopLogic', 'condition', e.target.value)}
                placeholder="Loop condition"
              />
            </div>
          </>
        )}
        
        <div className="form-actions">
          <button className="save-button" onClick={saveEditing}>Save</button>
          <button className="cancel-button" onClick={cancelEditing}>Cancel</button>
        </div>
      </div>
    );
  };

  // Render action details
  const renderActionDetails = (action: RecordedAction) => {
    return (
      <div className="action-details">
        {action.target && (
          <div className="detail-item">
            <span className="detail-label">Target:</span>
            <span className="detail-value">
              {action.target.id && `ID: ${action.target.id}`}
              {action.target.xpath && `XPath: ${action.target.xpath}`}
              {action.target.css && `CSS: ${action.target.css}`}
              {action.target.aiGeneratedLocator && `AI: ${action.target.aiGeneratedLocator}`}
            </span>
          </div>
        )}
        
        {action.value && (
          <div className="detail-item">
            <span className="detail-label">Value:</span>
            <span className="detail-value">{action.value}</span>
          </div>
        )}
        
        {action.customCode && (
          <div className="detail-item">
            <span className="detail-label">Custom Code:</span>
            <pre className="detail-value code">{action.customCode}</pre>
          </div>
        )}
        
        {action.conditionalLogic && (
          <div className="detail-item">
            <span className="detail-label">Condition:</span>
            <span className="detail-value">{action.conditionalLogic.condition}</span>
          </div>
        )}
        
        {action.loopLogic && (
          <div className="detail-item">
            <span className="detail-label">Loop:</span>
            <span className="detail-value">
              {`${action.loopLogic.loopType} (${action.loopLogic.condition})`}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="steps-list">
      <div className="steps-header">
        <h3>Recorded Actions</h3>
        <span className="step-count">{actions.length} steps</span>
      </div>
      
      {actions.length === 0 ? (
        <div className="empty-steps">
          <p>No actions recorded yet. Start recording to capture actions.</p>
        </div>
      ) : (
        <ul className="actions-list">
          {actions.map((action, index) => (
            <li 
              key={action.id} 
              className={`action-item ${expandedAction === action.id ? 'expanded' : ''} ${editingAction === action.id ? 'editing' : ''}`}
            >
              <div className="action-header" onClick={() => toggleExpand(action.id)}>
                <div className="action-number">{index + 1}</div>
                <div className="action-type">{getActionDisplayName(action.type)}</div>
                <div className="action-description">{action.description}</div>
                <div className="action-time">{formatTimestamp(action.timestamp)}</div>
                <div className="action-controls">
                  <button 
                    className="edit-button" 
                    onClick={(e) => {
                      e.stopPropagation();
                      startEditing(action);
                    }} 
                    title="Edit action"
                  >
                    Edit
                  </button>
                  <button 
                    className="delete-button" 
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteAction(action.id);
                    }} 
                    title="Delete action"
                  >
                    Delete
                  </button>
                </div>
              </div>
              
              {expandedAction === action.id && !editingAction && renderActionDetails(action)}
              {editingAction === action.id && renderEditForm(action)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default StepsList;


// cstestforge/frontend/src/components/recorder/BrowserFrame.tsx

import React, { useState, useEffect, useRef } from 'react';
import './BrowserFrame.css';

interface BrowserFrameProps {
  targetUrl: string;
  isRecording: boolean;
}

/**
 * Component that renders an iframe containing the application under test.
 * Handles communication with the iframe for test recording.
 */
const BrowserFrame: React.FC<BrowserFrameProps> = ({ targetUrl, isRecording }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [pageTitle, setPageTitle] = useState<string>('');
  const [injected, setInjected] = useState<boolean>(false);

  // Load the iframe when the target URL changes
  useEffect(() => {
    if (targetUrl) {
      loadUrl(targetUrl);
    }
  }, [targetUrl]);

  // Handle recording state changes
  useEffect(() => {
    if (isRecording && iframeRef.current) {
      injectRecordingScript();
    } else if (!isRecording && injected) {
      removeRecordingScript();
    }
  }, [isRecording, injected]);

  // Load a URL in the iframe
  const loadUrl = (url: string) => {
    if (!url) return;

    setIsLoading(true);
    setError(null);

    try {
      // Ensure URL has protocol
      const urlWithProtocol = url.startsWith('http') ? url : `https://${url}`;
      setCurrentUrl(urlWithProtocol);
    } catch (err) {
      console.error('Error loading URL:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to load URL: ${errorMessage}`);
      setIsLoading(false);
    }
  };

  // Handle iframe load event
  const handleIframeLoad = () => {
    setIsLoading(false);

    try {
      const iframe = iframeRef.current;
      if (iframe && iframe.contentWindow) {
        // Update current title and URL
        setPageTitle(iframe.contentWindow.document.title);
        setCurrentUrl(iframe.contentWindow.location.href);

        // Check if we should inject the recording script
        if (isRecording && !injected) {
          injectRecordingScript();
        }
      }
    } catch (err) {
      console.error('Error accessing iframe content:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Cannot access iframe content: ${errorMessage}`);
    }
  };

  // Handle iframe error
  const handleIframeError = () => {
    setIsLoading(false);
    setError('Failed to load the page. This could be due to Cross-Origin restrictions or the page may not exist.');
  };

  // Inject the recording script into the iframe
  const injectRecordingScript = () => {
    try {
      const iframe = iframeRef.current;
      if (!iframe || !iframe.contentWindow) return;

      const iframeDocument = iframe.contentWindow.document;

      // Create script element for injector
      const injectorScript = iframeDocument.createElement('script');
      injectorScript.id = 'cstestforge-recorder-script';
      injectorScript.type = 'text/javascript';
      injectorScript.textContent = `
        (function() {
          // Store original functions
          const originalAddEventListener = EventTarget.prototype.addEventListener;
          const originalRemoveEventListener = EventTarget.prototype.removeEventListener;
          
          // Create event tracking map
          const trackedEvents = new Map();
          
          // Override addEventListener
          EventTarget.prototype.addEventListener = function(type, listener, options) {
            // Track the event
            if (!trackedEvents.has(this)) {
              trackedEvents.set(this, new Map());
            }
            if (!trackedEvents.get(this).has(type)) {
              trackedEvents.get(this).set(type, new Set());
            }
            trackedEvents.get(this).get(type).add(listener);
            
            // Call original function
            return originalAddEventListener.call(this, type, listener, options);
          };
          
          // Override removeEventListener
          EventTarget.prototype.removeEventListener = function(type, listener, options) {
            // Remove from tracking
            if (trackedEvents.has(this) && trackedEvents.get(this).has(type)) {
              trackedEvents.get(this).get(type).delete(listener);
            }
            
            // Call original function
            return originalRemoveEventListener.call(this, type, listener, options);
          };
          
          // Create DOM observer
          const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
              // Handle DOM changes
              console.log('DOM mutation:', mutation);
            });
          });
          
          // Start observing
          observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true
          });
          
          // Define event handlers
          const handleClick = (event) => {
            const element = event.target;
            const xpath = getXPath(element);
            const css = getCssSelector(element);
            
            // Create action data
            const action = {
              id: generateUniqueId(),
              type: 'click',
              timestamp: Date.now(),
              target: {
                element: element.outerHTML,
                xpath: xpath,
                css: css,
                id: element.id,
                className: element.className,
                tagName: element.tagName,
                locatorConfidence: 1,
                alternativeLocators: []
              },
              description: \`Click on \${element.tagName.toLowerCase()}\${element.id ? ' #' + element.id : ''}\`,
              pageInfo: {
                title: document.title,
                url: window.location.href
              }
            };
            
            // Send action to parent
            window.parent.postMessage({
              type: 'RECORDED_ACTION',
              action: action
            }, '*');
          };
          
          const handleInput = (event) => {
            const element = event.target;
            const xpath = getXPath(element);
            const css = getCssSelector(element);
            
            // Create action data
            const action = {
              id: generateUniqueId(),
              type: 'type',
              timestamp: Date.now(),
              target: {
                element: element.outerHTML,
                xpath: xpath,
                css: css,
                id: element.id,
                className: element.className,
                tagName: element.tagName,
                locatorConfidence: 1,
                alternativeLocators: []
              },
              value: element.value,
              description: \`Type '\${element.value}' in \${element.tagName.toLowerCase()}\${element.id ? ' #' + element.id : ''}\`,
              pageInfo: {
                title: document.title,
                url: window.location.href
              }
            };
            
            // Send action to parent
            window.parent.postMessage({
              type: 'RECORDED_ACTION',
              action: action
            }, '*');
          };
          
          const handleSelect = (event) => {
            const element = event.target;
            const xpath = getXPath(element);
            const css = getCssSelector(element);
            
            // Get selected options
            const selectedOptions = Array.from(element.selectedOptions).map(option => ({
              text: option.text,
              value: option.value
            }));
            
            // Create action data
            const action = {
              id: generateUniqueId(),
              type: 'select',
              timestamp: Date.now(),
              target: {
                element: element.outerHTML,
                xpath: xpath,
                css: css,
                id: element.id,
                className: element.className,
                tagName: element.tagName,
                locatorConfidence: 1,
                alternativeLocators: []
              },
              value: JSON.stringify(selectedOptions),
              description: \`Select option(s) in \${element.tagName.toLowerCase()}\${element.id ? ' #' + element.id : ''}\`,
              pageInfo: {
                title: document.title,
                url: window.location.href
              }
            };
            
            // Send action to parent
            window.parent.postMessage({
              type: 'RECORDED_ACTION',
              action: action
            }, '*');
          };
          
          // Add event listeners
          document.addEventListener('click', handleClick, true);
          document.addEventListener('input', handleInput, true);
          document.addEventListener('change', handleSelect, true);
          
          // Helper functions
          function getXPath(element) {
            if (element.id) {
              return \`//*[@id="\${element.id}"]\`;
            }
            
            if (element === document.body) {
              return '/html/body';
            }
            
            if (!element.parentNode) {
              return '';
            }
            
            const siblings = Array.from(element.parentNode.children);
            const tagName = element.tagName.toLowerCase();
            let index = 1;
            
            for (let i = 0; i < siblings.length; i++) {
              const sibling = siblings[i];
              if (sibling === element) {
                break;
              }
              if (sibling.tagName.toLowerCase() === tagName) {
                index++;
              }
            }
            
            return \`\${getXPath(element.parentNode)}/\${tagName}[\${index}]\`;
          }
          
          function getCssSelector(element) {
            if (element.id) {
              return \`#\${element.id}\`;
            }
            
            if (element === document.body) {
              return 'body';
            }
            
            if (!element.parentNode) {
              return '';
            }
            
            const tagName = element.tagName.toLowerCase();
            const classes = Array.from(element.classList).join('.');
            const classSelector = classes ? \`.\${classes}\` : '';
            
            return \`\${getCssSelector(element.parentNode)} > \${tagName}\${classSelector}\`.trim();
          }
          
          function generateUniqueId() {
            return 'action_' + Math.random().toString(36).substr(2, 9);
          }
          
          // Add cleanup function
          window.removeCSTestForgeRecorder = function() {
            // Restore original functions
            EventTarget.prototype.addEventListener = originalAddEventListener;
            EventTarget.prototype.removeEventListener = originalRemoveEventListener;
            
            // Disconnect observer
            observer.disconnect();
            
            // Remove event listeners
            document.removeEventListener('click', handleClick, true);
            document.removeEventListener('input', handleInput, true);
            document.removeEventListener('change', handleSelect, true);
            
            // Remove script
            const script = document.getElementById('cstestforge-recorder-script');
            if (script) {
              script.remove();
            }
            
            console.log('CSTestForge recorder removed');
          };
          
          console.log('CSTestForge recorder injected');
        })();
      `;

      // Append script to iframe document
      iframeDocument.head.appendChild(injectorScript);
      setInjected(true);
      
      console.log('Recording script injected');
    } catch (err) {
      console.error('Error injecting recording script:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Cannot inject recording script: ${errorMessage}`);
    }
  };

  // Remove the recording script from the iframe
  const removeRecordingScript = () => {
    try {
      const iframe = iframeRef.current;
      if (!iframe || !iframe.contentWindow) return;

      // Call cleanup function
      if (typeof iframe.contentWindow.removeCSTestForgeRecorder === 'function') {
        iframe.contentWindow.removeCSTestForgeRecorder();
      }

      // Remove script element
      const script = iframe.contentWindow.document.getElementById('cstestforge-recorder-script');
      if (script) {
        script.remove();
      }

      setInjected(false);
      console.log('Recording script removed');
    } catch (err) {
      console.error('Error removing recording script:', err);
    }
  };

  // Refresh the iframe
  const refreshFrame = () => {
    if (iframeRef.current) {
      iframeRef.current.src = currentUrl;
    }
  };

  // Navigate back in the iframe history
  const navigateBack = () => {
    try {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.history.back();
      }
    } catch (err) {
      console.error('Error navigating back:', err);
    }
  };

  // Navigate forward in the iframe history
  const navigateForward = () => {
    try {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.history.forward();
      }
    } catch (err) {
      console.error('Error navigating forward:', err);
    }
  };

  return (
    <div className="browser-frame">
      <div className="browser-header">
        <div className="browser-controls">
          <button 
            className="browser-button back-button" 
            onClick={navigateBack}
            title="Go back"
          >
            ←
          </button>
          <button 
            className="browser-button forward-button" 
            onClick={navigateForward}
            title="Go forward"
          >
            →
          </button>
          <button 
            className="browser-button refresh-button" 
            onClick={refreshFrame}
            title="Refresh"
          >
            ↻
          </button>
        </div>
        
        <div className="browser-address-bar">
          <input 
            type="text" 
            value={currentUrl} 
            onChange={(e) => setCurrentUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                loadUrl(currentUrl);
              }
            }}
            placeholder="Enter URL"
          />
        </div>
        
        <div className="browser-status">
          {isRecording && (
            <div className="recording-indicator">Recording</div>
          )}
        </div>
      </div>
      
      <div className="browser-content">
        {isLoading ? (
          <div className="browser-loading">
            <div className="loading-spinner"></div>
            <p>Loading...</p>
          </div>
        ) : error ? (
          <div className="browser-error">
            <p>{error}</p>
            <button onClick={() => loadUrl(currentUrl)}>Retry</button>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            src={currentUrl}
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            sandbox="allow-same-origin allow-scripts allow-forms"
            title="Application Under Test"
          />
        )}
      </div>
    </div>
  );
};

export default BrowserFrame;


// cstestforge/frontend/src/components/recorder/ActionToolbar.tsx

import React, { useState } from 'react';
import { ActionType } from '../../types/recorder';
import './ActionToolbar.css';

interface ActionToolbarProps {
  onInsertAction: (actionType: ActionType) => void;
  disabled: boolean;
}

/**
 * Toolbar component for inserting custom actions during test recording
 */
const ActionToolbar: React.FC<ActionToolbarProps> = ({ 
  onInsertAction,
  disabled
}) => {
  const [expanded, setExpanded] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Toggle toolbar expansion
  const toggleExpand = () => {
    setExpanded(!expanded);
    setSelectedCategory(null);
  };

  // Toggle category expansion
  const toggleCategory = (category: string) => {
    setSelectedCategory(selectedCategory === category ? null : category);
  };

  // Action categories
  const actionCategories = [
    {
      name: 'Basic',
      actions: [
        { type: ActionType.CLICK, label: 'Click' },
        { type: ActionType.TYPE, label: 'Type' },
        { type: ActionType.SELECT, label: 'Select' },
        { type: ActionType.WAIT, label: 'Wait' }
      ]
    },
    {
      name: 'Advanced',
      actions: [
        { type: ActionType.HOVER, label: 'Hover' },
        { type: ActionType.DRAG_DROP, label: 'Drag & Drop' },
        { type: ActionType.RIGHT_CLICK, label: 'Right Click' },
        { type: ActionType.DOUBLE_CLICK, label: 'Double Click' },
        { type: ActionType.SCROLL, label: 'Scroll' }
      ]
    },
    {
      name: 'Navigation',
      actions: [
        { type: ActionType.NAVIGATE, label: 'Navigate' },
        { type: ActionType.PAGE_REFRESH, label: 'Refresh Page' },
        { type: ActionType.SWITCH_TAB, label: 'Switch Tab' }
      ]
    },
    {
      name: 'Programming',
      actions: [
        { type: ActionType.CONDITION, label: 'Condition' },
        { type: ActionType.LOOP, label: 'Loop' },
        { type: ActionType.CUSTOM_CODE, label: 'Custom Code' }
      ]
    },
    {
      name: 'Verification',
      actions: [
        { type: ActionType.ASSERT, label: 'Assert' },
        { type: ActionType.SCREENSHOT, label: 'Screenshot' }
      ]
    }
  ];

  // Handle action insertion
  const handleActionClick = (actionType: ActionType) => {
    if (!disabled) {
      onInsertAction(actionType);
      setExpanded(false);
      setSelectedCategory(null);
    }
  };

  return (
    <div className={`action-toolbar ${expanded ? 'expanded' : 'collapsed'}`}>
      <button 
        className="toolbar-toggle"
        onClick={toggleExpand}
        disabled={disabled}
        title={expanded ? 'Collapse toolbar' : 'Expand toolbar'}
      >
        {expanded ? '◀' : '▶'} {expanded ? 'Hide' : 'Actions'}
      </button>
      
      {expanded && (
        <div className="toolbar-content">
          <h3>Insert Action</h3>
          
          <div className="action-categories">
            {actionCategories.map(category => (
              <div key={category.name} className="action-category">
                <div 
                  className={`category-header ${selectedCategory === category.name ? 'selected' : ''}`}
                  onClick={() => toggleCategory(category.name)}
                >
                  <span className="category-name">{category.name}</span>
                  <span className="category-toggle">{selectedCategory === category.name ? '▼' : '▶'}</span>
                </div>
                
                {selectedCategory === category.name && (
                  <div className="category-actions">
                    {category.actions.map(action => (
                      <button
                        key={action.type}
                        className="action-button"
                        onClick={() => handleActionClick(action.type)}
                        disabled={disabled}
                        title={`Insert ${action.label} action`}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          
          <div className="toolbar-footer">
            <p className="toolbar-help">
              Click on an action to insert it at the current step in the recording.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActionToolbar;


// cstestforge/frontend/src/components/recorder/ElementHighlighter.tsx

import React, { useState, useEffect } from 'react';
import './ElementHighlighter.css';

/**
 * Component that highlights elements in the browser frame during recording
 * to help users identify elements and their properties.
 */
const ElementHighlighter: React.FC = () => {
  const [visible, setVisible] = useState<boolean>(false);
  const [position, setPosition] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [elementInfo, setElementInfo] = useState<{
    tagName: string;
    id: string;
    className: string;
    xpath: string;
    cssSelector: string;
  } | null>(null);

  useEffect(() => {
    // Add message listener for element hover events from the iframe
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'ELEMENT_HOVER') {
        const { rect, info } = event.data;
        
        if (rect) {
          setVisible(true);
          setPosition({
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height
          });
          setElementInfo(info);
        } else {
          setVisible(false);
        }
      }
    };

    window.addEventListener('message', handleMessage);

    // Inject element tracking script into the iframe
    const injectTrackingScript = () => {
      const iframes = document.querySelectorAll('iframe');
      
      iframes.forEach(iframe => {
        try {
          if (iframe.contentWindow && iframe.contentDocument) {
            const script = iframe.contentDocument.createElement('script');
            script.id = 'element-highlighter-script';
            script.textContent = `
              (function() {
                let hoveredElement = null;
                let throttleTimeout = null;
                
                function getElementInfo(element) {
                  return {
                    tagName: element.tagName.toLowerCase(),
                    id: element.id,
                    className: element.className,
                    xpath: getXPath(element),
                    cssSelector: getCssSelector(element)
                  };
                }
                
                function getXPath(element) {
                  if (element.id) {
                    return \`//*[@id="\${element.id}"]\`;
                  }
                  
                  if (element === document.body) {
                    return '/html/body';
                  }
                  
                  if (!element.parentNode) {
                    return '';
                  }
                  
                  const siblings = Array.from(element.parentNode.children);
                  const tagName = element.tagName.toLowerCase();
                  let index = 1;
                  
                  for (let i = 0; i < siblings.length; i++) {
                    const sibling = siblings[i];
                    if (sibling === element) {
                      break;
                    }
                    if (sibling.tagName.toLowerCase() === tagName) {
                      index++;
                    }
                  }
                  
                  return \`\${getXPath(element.parentNode)}/\${tagName}[\${index}]\`;
                }
                
                function getCssSelector(element) {
                  if (element.id) {
                    return \`#\${element.id}\`;
                  }
                  
                  if (element === document.body) {
                    return 'body';
                  }
                  
                  if (!element.parentNode) {
                    return '';
                  }
                  
                  const tagName = element.tagName.toLowerCase();
                  const classes = Array.from(element.classList).join('.');
                  const classSelector = classes ? \`.\${classes}\` : '';
                  
                  return \`\${getCssSelector(element.parentNode)} > \${tagName}\${classSelector}\`.trim();
                }
                
                function handleMouseOver(event) {
                  if (throttleTimeout) {
                    clearTimeout(throttleTimeout);
                  }
                  
                  throttleTimeout = setTimeout(() => {
                    hoveredElement = event.target;
                    const rect = hoveredElement.getBoundingClientRect();
                    
                    // Get absolute position within page
                    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
                    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                    
                    // Get iframe position
                    const iframeRect = window.frameElement.getBoundingClientRect();
                    
                    // Calculate absolute position relative to the top frame
                    const absoluteRect = {
                      left: rect.left + scrollLeft + iframeRect.left,
                      top: rect.top + scrollTop + iframeRect.top,
                      width: rect.width,
                      height: rect.height
                    };
                    
                    window.parent.postMessage({
                      type: 'ELEMENT_HOVER',
                      rect: absoluteRect,
                      info: getElementInfo(hoveredElement)
                    }, '*');
                  }, 50); // 50ms throttle
                }
                
                function handleMouseOut() {
                  if (throttleTimeout) {
                    clearTimeout(throttleTimeout);
                  }
                  
                  throttleTimeout = setTimeout(() => {
                    hoveredElement = null;
                    
                    window.parent.postMessage({
                      type: 'ELEMENT_HOVER',
                      rect: null,
                      info: null
                    }, '*');
                  }, 50); // 50ms throttle
                }
                
                document.addEventListener('mouseover', handleMouseOver, true);
                document.addEventListener('mouseout', handleMouseOut, true);
                
                // Add cleanup function
                window.removeElementHighlighter = function() {
                  document.removeEventListener('mouseover', handleMouseOver, true);
                  document.removeEventListener('mouseout', handleMouseOut, true);
                  
                  // Remove script
                  const script = document.getElementById('element-highlighter-script');
                  if (script) {
                    script.remove();
                  }
                  
                  console.log('Element highlighter removed');
                };
                
                console.log('Element highlighter injected');
              })();
            `;
            
            iframe.contentDocument.head.appendChild(script);
          }
        } catch (err) {
          console.error('Error injecting element highlighter script:', err);
        }
      });
    };

    // Try to inject tracking script initially
    injectTrackingScript();

    // Retry injecting script when iframes load
    const handleIframeLoad = () => {
      setTimeout(injectTrackingScript, 500); // Delay to ensure iframe is fully loaded
    };

    const iframes = document.querySelectorAll('iframe');
    iframes.forEach(iframe => {
      iframe.addEventListener('load', handleIframeLoad);
    });

    return () => {
      window.removeEventListener('message', handleMessage);
      
      // Remove tracking script
      const iframes = document.querySelectorAll('iframe');
      iframes.forEach(iframe => {
        iframe.removeEventListener('load', handleIframeLoad);
        
        try {
          if (iframe.contentWindow && iframe.contentWindow.removeElementHighlighter) {
            iframe.contentWindow.removeElementHighlighter();
          }
        } catch (err) {
          console.error('Error removing element highlighter:', err);
        }
      });
    };
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <>
      <div 
        className="element-highlight"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: `${position.width}px`,
          height: `${position.height}px`
        }}
      />
      
      {elementInfo && (
        <div 
          className="element-info"
          style={{
            left: `${position.x}px`,
            top: `${position.y + position.height}px`
          }}
        >
          <div className="info-tag">
            <span className="info-label">Tag:</span>
            <span className="info-value">{elementInfo.tagName}</span>
          </div>
          
          {elementInfo.id && (
            <div className="info-id">
              <span className="info-label">ID:</span>
              <span className="info-value">{elementInfo.id}</span>
            </div>
          )}
          
          {elementInfo.className && (
            <div className="info-class">
              <span className="info-label">Class:</span>
              <span className="info-value">{elementInfo.className}</span>
            </div>
          )}
          
          <div className="info-xpath">
            <span className="info-label">XPath:</span>
            <span className="info-value">{elementInfo.xpath}</span>
          </div>
          
          <div className="info-css">
            <span className="info-label">CSS:</span>
            <span className="info-value">{elementInfo.cssSelector}</span>
          </div>
        </div>
      )}
    </>
  );
};

export default ElementHighlighter;


/* cstestforge/frontend/src/components/recorder/TestRecorder.css */

.test-recorder {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #f8f9fa;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  overflow: hidden;
}

.test-recorder-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background-color: #343a40;
  color: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.test-recorder-header h2 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
}

.recording-status {
  display: flex;
  align-items: center;
  gap: 12px;
}

.recording-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: #d32f2f;
  animation: pulse 1.5s infinite;
}

.recording-indicator.paused {
  animation: none;
  background-color: #ffab00;
}

.recording-time {
  font-family: monospace;
  font-size: 1.125rem;
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(211, 47, 47, 0.7);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(211, 47, 47, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(211, 47, 47, 0);
  }
}

.error-message {
  margin: 0;
  padding: 12px 24px;
  background-color: #ffebee;
  color: #c62828;
  border-left: 4px solid #c62828;
  font-size: 0.875rem;
}

.test-recorder-settings {
  padding: 16px 24px;
  border-bottom: 1px solid #e5e5e5;
}

.test-recorder-controls {
  padding: 16px 24px;
  border-bottom: 1px solid #e5e5e5;
  background-color: #f0f0f0;
}

.test-recorder-workspace {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.test-recorder-browser-container {
  flex: 3;
  position: relative;
  border-right: 1px solid #e5e5e5;
  background-color: #ffffff;
  overflow: hidden;
}

.test-recorder-steps-container {
  flex: 1;
  min-width: 320px;
  max-width: 480px;
  overflow-y: auto;
  background-color: #ffffff;
}

@media (max-width: 1200px) {
  .test-recorder-workspace {
    flex-direction: column;
  }
  
  .test-recorder-browser-container,
  .test-recorder-steps-container {
    flex: none;
    max-width: none;
    height: 50%;
  }
  
  .test-recorder-browser-container {
    border-right: none;
    border-bottom: 1px solid #e5e5e5;
  }
}

/* cstestforge/frontend/src/components/recorder/RecorderControls.css */

.recorder-controls {
  display: flex;
  gap: 16px;
  justify-content: center;
  align-items: center;
}

.control-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.start-button {
  background-color: #ffebee;
  color: #c62828;
}

.start-button:hover {
  background-color: #ffcdd2;
}

.pause-button {
  background-color: #fff8e1;
  color: #ff8f00;
}

.pause-button:hover {
  background-color: #ffecb3;
}

.resume-button {
  background-color: #e8f5e9;
  color: #2e7d32;
}

.resume-button:hover {
  background-color: #c8e6c9;
}

.stop-button {
  background-color: #e8eaf6;
  color: #3949ab;
}

.stop-button:hover {
  background-color: #c5cae9;
}

.control-button svg {
  width: 20px;
  height: 20px;
}

.control-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* cstestforge/frontend/src/components/recorder/RecorderSettings.css */

.recorder-settings-form {
  width: 100%;
}

.settings-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 16px;
}

.settings-field {
  flex: 1;
  min-width: 200px;
}

.settings-field label {
  display: block;
  margin-bottom: 4px;
  font-size: 0.875rem;
  font-weight: 600;
  color: #495057;
}

.settings-field input[type="text"],
.settings-field input[type="url"],
.settings-field input[type="number"],
.settings-field select {
  width: 100%;
  padding: 8px 12px;
  font-size: 0.875rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
  background-color: #fff;
  transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
}

.settings-field input:focus,
.settings-field select:focus {
  border-color: #80bdff;
  outline: 0;
  box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
}

.settings-field input:disabled,
.settings-field select:disabled {
  background-color: #e9ecef;
  opacity: 1;
  cursor: not-allowed;
}

.settings-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
}

.settings-checkbox input[type="checkbox"] {
  width: 16px;
  height: 16px;
  margin: 0;
}

.settings-checkbox label {
  margin-bottom: 0;
}

/* cstestforge/frontend/src/components/recorder/BrowserFrame.css */

.browser-frame {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #f1f3f5;
  border-radius: 4px;
  overflow: hidden;
}

.browser-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background-color: #e9ecef;
  border-bottom: 1px solid #dee2e6;
}

.browser-controls {
  display: flex;
  gap: 4px;
}

.browser-button {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: transparent;
  border: none;
  border-radius: 50%;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.browser-button:hover {
  background-color: #dee2e6;
}

.browser-address-bar {
  flex: 1;
  margin: 0 8px;
}

.browser-address-bar input {
  width: 100%;
  padding: 6px 12px;
  font-size: 0.875rem;
  border: 1px solid #ced4da;
  border-radius: 16px;
  background-color: #ffffff;
}

.browser-address-bar input:focus {
  outline: none;
  border-color: #80bdff;
  box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
}

.browser-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.recording-indicator {
  padding: 4px 8px;
  background-color: #d32f2f;
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 12px;
}

.browser-content {
  flex: 1;
  position: relative;
  background-color: #ffffff;
}

.browser-content iframe {
  width: 100%;
  height: 100%;
  border: none;
}

.browser-loading,
.browser-error {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: #ffffff;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.browser-error {
  color: #721c24;
  background-color: #f8d7da;
  text-align: center;
  padding: 24px;
}

.browser-error button {
  margin-top: 16px;
  padding: 6px 12px;
  background-color: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.browser-error button:hover {
  background-color: #c82333;
}

/* cstestforge/frontend/src/components/recorder/StepsList.css */

.steps-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #ffffff;
}

.steps-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #e5e5e5;
}

.steps-header h3 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #343a40;
}

.step-count {
  padding: 4px 8px;
  background-color: #e9ecef;
  color: #495057;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 12px;
}

.empty-steps {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  color: #6c757d;
  text-align: center;
}

.actions-list {
  flex: 1;
  margin: 0;
  padding: 0;
  list-style-type: none;
  overflow-y: auto;
}

.action-item {
  border-bottom: 1px solid #e5e5e5;
  transition: background-color 0.15s ease;
}

.action-item:hover {
  background-color: #f8f9fa;
}

.action-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
}

.action-number {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #e9ecef;
  border-radius: 50%;
  font-size: 0.75rem;
  font-weight: 600;
  color: #495057;
  margin-right: 12px;
}

.action-type {
  width: 120px;
  font-weight: 600;
  color: #495057;
}

.action-description {
  flex: 1;
  font-size: 0.875rem;
  color: #212529;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.action-time {
  font-size: 0.75rem;
  color: #6c757d;
  margin-left: 12px;
  margin-right: 12px;
}

.action-controls {
  display: flex;
  gap: 8px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.action-item:hover .action-controls {
  opacity: 1;
}

.edit-button,
.delete-button {
  padding: 4px 8px;
  font-size: 0.75rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.edit-button {
  background-color: #e9ecef;
  color: #495057;
}

.edit-button:hover {
  background-color: #dee2e6;
}

.delete-button {
  background-color: #ffebee;
  color: #c62828;
}

.delete-button:hover {
  background-color: #ffcdd2;
}

.action-details {
  padding: 12px 16px 16px 40px;
  background-color: #f8f9fa;
  border-top: 1px dashed #dee2e6;
  font-size: 0.875rem;
}

.detail-item {
  display: flex;
  margin-bottom: 8px;
}

.detail-item:last-child {
  margin-bottom: 0;
}

.detail-label {
  width: 80px;
  font-weight: 600;
  color: #495057;
}

.detail-value {
  flex: 1;
  word-break: break-word;
}

.detail-value.code {
  font-family: monospace;
  padding: 8px;
  background-color: #f1f3f5;
  border-radius: 4px;
  white-space: pre-wrap;
  overflow-x: auto;
}

.edit-form {
  padding: 16px;
  background-color: #f8f9fa;
  border-top: 1px dashed #dee2e6;
}

.form-group {
  margin-bottom: 16px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  margin-bottom: 4px;
  font-size: 0.875rem;
  font-weight: 600;
  color: #495057;
}

.form-group input[type="text"],
.form-group input[type="number"],
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 8px 12px;
  font-size: 0.875rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
  background-color: #fff;
  transition: border-color 0.15s ease;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  border-color: #80bdff;
  outline: 0;
  box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
}

.form-group textarea {
  min-height: 100px;
  font-family: monospace;
  resize: vertical;
}

.form-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.form-actions button {
  padding: 6px 12px;
  font-size: 0.875rem;
  font-weight: 600;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.save-button {
  background-color: #e8f5e9;
  color: #2e7d32;
}

.save-button:hover {
  background-color: #c8e6c9;
}

.cancel-button {
  background-color: #e9ecef;
  color: #495057;
}

.cancel-button:hover {
  background-color: #dee2e6;
}

/* cstestforge/frontend/src/components/recorder/ActionToolbar.css */

.action-toolbar {
  position: absolute;
  top: 50%;
  right: 0;
  transform: translateY(-50%);
  background-color: #ffffff;
  border: 1px solid #dee2e6;
  border-right: none;
  border-radius: 4px 0 0 4px;
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  transition: transform 0.3s ease;
}

.action-toolbar.collapsed {
  transform: translateY(-50%) translateX(calc(100% - 36px));
}

.toolbar-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 100px;
  writing-mode: vertical-lr;
  text-orientation: mixed;
  transform: rotate(180deg);
  background-color: #f8f9fa;
  border: none;
  border-right: 1px solid #dee2e6;
  border-radius: 0 0 0 4px;
  font-size: 0.875rem;
  font-weight: 600;
  color: #495057;
  cursor: pointer;
}

.toolbar-toggle:hover {
  background-color: #e9ecef;
}

.toolbar-toggle:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.toolbar-content {
  width: 280px;
  max-height: 500px;
  overflow-y: auto;
  padding: 16px;
}

.toolbar-content h3 {
  margin: 0 0 16px 0;
  font-size: 1rem;
  font-weight: 600;
  color: #343a40;
}

.action-categories {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.action-category {
  border: 1px solid #dee2e6;
  border-radius: 4px;
  overflow: hidden;
}

.category-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background-color: #f8f9fa;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.category-header:hover {
  background-color: #e9ecef;
}

.category-header.selected {
  background-color: #e9ecef;
}

.category-name {
  font-weight: 600;
  color: #495057;
}

.category-toggle {
  font-size: 0.75rem;
  color: #6c757d;
}

.category-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px;
  background-color: #ffffff;
  border-top: 1px solid #dee2e6;
}

.action-button {
  flex: 1;
  min-width: 100px;
  padding: 6px 12px;
  background-color: #f1f3f5;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  font-size: 0.875rem;
  color: #495057;
  cursor: pointer;
  transition: all 0.15s ease;
}

.action-button:hover {
  background-color: #e9ecef;
  border-color: #ced4da;
}

.action-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.toolbar-footer {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #dee2e6;
}

.toolbar-help {
  margin: 0;
  font-size: 0.75rem;
  color: #6c757d;
}

/* cstestforge/frontend/src/components/recorder/ElementHighlighter.css */

.element-highlight {
  position: absolute;
  pointer-events: none;
  border: 2px solid #2196f3;
  background-color: rgba(33, 150, 243, 0.1);
  z-index: 9999;
  box-shadow: 0 0 0 1px rgba(33, 150, 243, 0.5);
  transition: all 0.2s ease;
}

.element-info {
  position: absolute;
  width: 280px;
  padding: 8px;
  background-color: #ffffff;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  font-size: 0.75rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  z-index: 10000;
}

.element-info > div {
  margin-bottom: 4px;
  word-break: break-word;
}

.element-info > div:last-child {
  margin-bottom: 0;
}

.info-label {
  font-weight: 600;
  color: #495057;
  margin-right: 4px;
}

.info-value {
  font-family: monospace;
  color: #212529;
}

.info-xpath .info-value,
.info-css .info-value {
  display: block;
  margin-top: 2px;
  padding: 4px;
  background-color: #f8f9fa;
  border-radius: 2px;
  overflow-x: auto;
}



Parent POM.xml
--------------------
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    
    <groupId>com.cstestforge</groupId>
    <artifactId>cstestforge</artifactId>
    <version>1.0.0-SNAPSHOT</version>
    <packaging>pom</packaging>
    <name>CSTestForge</name>
    <description>Advanced Test Automation Tool with AI-Powered Recording and Execution</description>
    
    <modules>
        <module>backend</module>
        <module>frontend</module>
    </modules>
    
    <properties>
        <java.version>17</java.version>
        <maven.compiler.source>${java.version}</maven.compiler.source>
        <maven.compiler.target>${java.version}</maven.compiler.target>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
        <project.reporting.outputEncoding>UTF-8</project.reporting.outputEncoding>
        <spring-boot.version>3.1.0</spring-boot.version>
        <node.version>18.16.0</node.version>
        <npm.version>9.5.1</npm.version>
    </properties>
    
    <dependencyManagement>
        <dependencies>
            <!-- Spring Boot BOM -->
            <dependency>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-dependencies</artifactId>
                <version>${spring-boot.version}</version>
                <type>pom</type>
                <scope>import</scope>
            </dependency>
        </dependencies>
    </dependencyManagement>
    
    <build>
        <pluginManagement>
            <plugins>
                <plugin>
                    <groupId>org.springframework.boot</groupId>
                    <artifactId>spring-boot-maven-plugin</artifactId>
                    <version>${spring-boot.version}</version>
                </plugin>
                <plugin>
                    <groupId>org.apache.maven.plugins</groupId>
                    <artifactId>maven-compiler-plugin</artifactId>
                    <version>3.11.0</version>
                    <configuration>
                        <source>${java.version}</source>
                        <target>${java.version}</target>
                        <annotationProcessorPaths>
                            <path>
                                <groupId>org.projectlombok</groupId>
                                <artifactId>lombok</artifactId>
                                <version>1.18.26</version>
                            </path>
                        </annotationProcessorPaths>
                    </configuration>
                </plugin>
                <plugin>
                    <groupId>com.github.eirslett</groupId>
                    <artifactId>frontend-maven-plugin</artifactId>
                    <version>1.12.1</version>
                    <configuration>
                        <nodeVersion>v${node.version}</nodeVersion>
                        <npmVersion>${npm.version}</npmVersion>
                    </configuration>
                </plugin>
            </plugins>
        </pluginManagement>
    </build>
    
    <profiles>
        <profile>
            <id>dev</id>
            <activation>
                <activeByDefault>true</activeByDefault>
            </activation>
            <properties>
                <spring.profiles.active>dev</spring.profiles.active>
            </properties>
        </profile>
        <profile>
            <id>prod</id>
            <properties>
                <spring.profiles.active>prod</spring.profiles.active>
            </properties>
        </profile>
    </profiles>
</project>


BackendPOM.xml
----------------

<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    
    <parent>
        <groupId>com.cstestforge</groupId>
        <artifactId>cstestforge</artifactId>
        <version>1.0.0-SNAPSHOT</version>
    </parent>
    
    <artifactId>cstestforge-backend</artifactId>
    <name>CSTestForge Backend</name>
    <description>Spring Boot Backend for CSTestForge</description>
    
    <dependencies>
        <!-- Spring Boot -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-websocket</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-validation</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-actuator</artifactId>
        </dependency>
        
        <!-- Testing Frameworks -->
        <dependency>
            <groupId>org.seleniumhq.selenium</groupId>
            <artifactId>selenium-java</artifactId>
            <version>4.10.0</version>
        </dependency>
        <dependency>
            <groupId>com.microsoft.playwright</groupId>
            <artifactId>playwright</artifactId>
            <version>1.33.0</version>
        </dependency>
        <dependency>
            <groupId>org.testng</groupId>
            <artifactId>testng</artifactId>
            <version>7.7.1</version>
        </dependency>
        <dependency>
            <groupId>io.cucumber</groupId>
            <artifactId>cucumber-java</artifactId>
            <version>7.12.0</version>
        </dependency>
        <dependency>
            <groupId>io.cucumber</groupId>
            <artifactId>cucumber-testng</artifactId>
            <version>7.12.0</version>
        </dependency>
        
        <!-- DevOps Integration -->
        <dependency>
            <groupId>org.eclipse.jgit</groupId>
            <artifactId>org.eclipse.jgit</artifactId>
            <version>6.5.0.202303070854-r</version>
        </dependency>
        <dependency>
            <groupId>com.microsoft.azure</groupId>
            <artifactId>azure-client-authentication</artifactId>
            <version>1.7.14</version>
        </dependency>
        <dependency>
            <groupId>com.microsoft.azure.devops</groupId>
            <artifactId>azure-devops-java-api</artifactId>
            <version>0.11.0</version>
        </dependency>
        
        <!-- Utils -->
        <dependency>
            <groupId>org.projectlombok</groupId>
            <artifactId>lombok</artifactId>
            <optional>true</optional>
        </dependency>
        <dependency>
            <groupId>com.fasterxml.jackson.core</groupId>
            <artifactId>jackson-databind</artifactId>
        </dependency>
        <dependency>
            <groupId>org.apache.commons</groupId>
            <artifactId>commons-lang3</artifactId>
        </dependency>
        <dependency>
            <groupId>org.apache.commons</groupId>
            <artifactId>commons-collections4</artifactId>
            <version>4.4</version>
        </dependency>
        <dependency>
            <groupId>commons-io</groupId>
            <artifactId>commons-io</artifactId>
            <version>2.13.0</version>
        </dependency>
        <dependency>
            <groupId>org.apache.velocity</groupId>
            <artifactId>velocity-engine-core</artifactId>
            <version>2.3</version>
        </dependency>
        
        <!-- AI & ML -->
        <dependency>
            <groupId>org.tensorflow</groupId>
            <artifactId>tensorflow-core-platform</artifactId>
            <version>0.5.0</version>
        </dependency>
        <dependency>
            <groupId>ai.djl</groupId>
            <artifactId>api</artifactId>
            <version>0.22.1</version>
        </dependency>
        <dependency>
            <groupId>ai.djl.tensorflow</groupId>
            <artifactId>tensorflow-engine</artifactId>
            <version>0.22.1</version>
        </dependency>
        
        <!-- Database -->
        <dependency>
            <groupId>com.h2database</groupId>
            <artifactId>h2</artifactId>
            <scope>runtime</scope>
        </dependency>
        
        <!-- Testing -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>org.mockito</groupId>
            <artifactId>mockito-core</artifactId>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>org.junit.jupiter</groupId>
            <artifactId>junit-jupiter-api</artifactId>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>org.junit.jupiter</groupId>
            <artifactId>junit-jupiter-engine</artifactId>
            <scope>test</scope>
        </dependency>
    </dependencies>
    
    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
                <executions>
                    <execution>
                        <goals>
                            <goal>repackage</goal>
                        </goals>
                    </execution>
                </executions>
                <configuration>
                    <excludes>
                        <exclude>
                            <groupId>org.projectlombok</groupId>
                            <artifactId>lombok</artifactId>
                        </exclude>
                    </excludes>
                </configuration>
            </plugin>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-compiler-plugin</artifactId>
            </plugin>
        </plugins>
    </build>
</project>

Frontend POM.xml
--------------------

<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    
    <parent>
        <groupId>com.cstestforge</groupId>
        <artifactId>cstestforge</artifactId>
        <version>1.0.0-SNAPSHOT</version>
    </parent>
    
    <artifactId>cstestforge-frontend</artifactId>
    <n>CSTestForge Frontend</n>
    <description>React TypeScript Frontend for CSTestForge</description>
    
    <build>
        <plugins>
            <plugin>
                <groupId>com.github.eirslett</groupId>
                <artifactId>frontend-maven-plugin</artifactId>
                <executions>
                    <!-- Install Node and NPM -->
                    <execution>
                        <id>install-node-and-npm</id>
                        <goals>
                            <goal>install-node-and-npm</goal>
                        </goals>
                        <phase>generate-resources</phase>
                    </execution>
                    
                    <!-- Install dependencies -->
                    <execution>
                        <id>npm-install</id>
                        <goals>
                            <goal>npm</goal>
                        </goals>
                        <phase>generate-resources</phase>
                        <configuration>
                            <arguments>install</arguments>
                        </configuration>
                    </execution>
                    
                    <!-- Build frontend -->
                    <execution>
                        <id>npm-build</id>
                        <goals>
                            <goal>npm</goal>
                        </goals>
                        <phase>compile</phase>
                        <configuration>
                            <arguments>run build</arguments>
                        </configuration>
                    </execution>
                    
                    <!-- Run tests -->
                    <execution>
                        <id>npm-test</id>
                        <goals>
                            <goal>npm</goal>
                        </goals>
                        <phase>test</phase>
                        <configuration>
                            <arguments>test -- --watchAll=false</arguments>
                        </configuration>
                    </execution>
                </executions>
            </plugin>
            
            <!-- Copy frontend build to backend static resources -->
            <plugin>
                <artifactId>maven-resources-plugin</artifactId>
                <version>3.3.1</version>
                <executions>
                    <execution>
                        <id>copy-frontend-build</id>
                        <phase>package</phase>
                        <goals>
                            <goal>copy-resources</goal>
                        </goals>
                        <configuration>
                            <outputDirectory>${project.parent.basedir}/backend/src/main/resources/static</outputDirectory>
                            <resources>
                                <resource>
                                    <directory>${project.basedir}/build</directory>
                                    <filtering>false</filtering>
                                </resource>
                            </resources>
                        </configuration>
                    </execution>
                </executions>
            </plugin>
        </plugins>
    </build>
    
    <profiles>
        <profile>
            <id>dev</id>
            <activation>
                <activeByDefault>true</activeByDefault>
            </activation>
            <build>
                <plugins>
                    <plugin>
                        <groupId>com.github.eirslett</groupId>
                        <artifactId>frontend-maven-plugin</artifactId>
                        <executions>
                            <!-- Start the development server -->
                            <execution>
                                <id>npm-start</id>
                                <goals>
                                    <goal>npm</goal>
                                </goals>
                                <phase>process-resources</phase>
                                <configuration>
                                    <arguments>start</arguments>
                                </configuration>
                            </execution>
                        </executions>
                    </plugin>
                </plugins>
            </build>
        </profile>
    </profiles>
</project>


package.json
--------------

{
  "name": "cstestforge-frontend",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "@monaco-editor/react": "^4.5.1",
    "@testing-library/jest-dom": "^5.16.5",
    "@testing-library/react": "^14.0.0",
    "@testing-library/user-event": "^14.4.3",
    "@types/jest": "^29.5.2",
    "@types/node": "^20.3.1",
    "@types/react": "^18.2.12",
    "@types/react-dom": "^18.2.5",
    "@types/uuid": "^9.0.2",
    "axios": "^1.4.0",
    "chart.js": "^4.3.0",
    "color": "^4.2.3",
    "highlight.js": "^11.8.0",
    "monaco-editor": "^0.39.0",
    "react": "^18.2.0",
    "react-chartjs-2": "^5.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.12.1",
    "react-scripts": "5.0.1",
    "socket.io-client": "^4.6.2",
    "typescript": "^5.1.3",
    "uuid": "^9.0.0",
    "web-vitals": "^3.3.2"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  },
  "eslintConfig": {
    "extends": [
      "react-app",
      "react-app/jest"
    ]
  },
  "browserslist": {
    "production": [
      ">0.2%",
      "not dead",
      "not op_mini all"
    ],
    "development": [
      "last 1 chrome version",
      "last 1 firefox version",
      "last 1 safari version"
    ]
  },
  "devDependencies": {
    "@types/color": "^3.0.3",
    "@typescript-eslint/eslint-plugin": "^5.59.11",
    "@typescript-eslint/parser": "^5.59.11",
    "eslint": "^8.42.0",
    "eslint-plugin-react": "^7.32.2",
    "eslint-plugin-react-hooks": "^4.6.0"
  },
  "proxy": "http://localhost:8080"
}


