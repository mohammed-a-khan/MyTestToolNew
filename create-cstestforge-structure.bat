@echo off
REM Create CSTestForge project structure
echo Creating CSTestForge project folder structure...

REM Create root directory
mkdir cstestforge
cd cstestforge

REM Create root pom.xml
echo <!-- Parent Maven POM file --> > pom.xml

REM Create frontend directory structure
mkdir frontend
cd frontend
echo <!-- Frontend Maven module --> > pom.xml
echo // NPM dependencies > package.json
echo // TypeScript configuration > tsconfig.json
echo // Webpack configuration > webpack.config.js

REM Create public directory
mkdir public
cd public
echo <!-- Main HTML file --> > index.html
type nul > favicon.ico

REM Create assets
mkdir assets
cd assets
mkdir images
cd images
type nul > logo.png
cd ..
mkdir fonts
cd ..
cd ..

REM Create src directory and its subdirectories
mkdir src
cd src
echo // Entry point > index.tsx
echo // Main application component > App.tsx
echo // Route definitions > routes.tsx

REM Create assets folder
mkdir assets
cd assets
mkdir icons
mkdir styles
cd styles
mkdir common
cd common
echo /* Button component styles */ > button.css
echo /* Dropdown component styles */ > dropdown.css
echo /* Input component styles */ > input.css
echo /* Modal component styles */ > modal.css
echo /* Navbar component styles */ > navbar.css
echo /* Sidebar component styles */ > sidebar.css
echo /* Tabs component styles */ > tabs.css
cd ..

mkdir pages
cd pages
echo /* Home page styles */ > homePage.css
echo /* Recorder page styles */ > recorderPage.css
echo /* Editor page styles */ > editorPage.css
echo /* Runner page styles */ > runnerPage.css
echo /* Reports page styles */ > reportsPage.css
echo /* Settings page styles */ > settingsPage.css
cd ..

echo /* Recorder component styles */ > recorder.css
echo /* Browser frame component styles */ > browser-frame.css
echo /* Element highlighter styles */ > element-highlighter.css
echo /* Steps list component styles */ > steps-list.css
echo /* Action toolbar component styles */ > action-toolbar.css
echo /* Recorder settings component styles */ > recorder-settings.css
cd ..
cd ..

REM Create components directory
mkdir components
cd components

mkdir common
cd common
echo // Button component > Button.tsx
echo // Dropdown component > Dropdown.tsx
echo // Input component > Input.tsx
echo // Modal component > Modal.tsx
echo // Navigation bar component > NavBar.tsx
echo // Sidebar component > Sidebar.tsx
echo // Tabs component > Tabs.tsx
cd ..

mkdir recorder
cd recorder
echo // Action toolbar component > ActionToolbar.tsx
echo // Browser frame component > BrowserFrame.tsx
echo // Element highlighter component > ElementHighlighter.tsx
echo // Recorder controls component > RecorderControls.tsx
echo // Recorder settings component > RecorderSettings.tsx
echo // Steps list component > StepsList.tsx
cd ..

mkdir editor
cd editor
echo // Code editor component > CodeEditor.tsx
echo // Step editor component > StepEditor.tsx
echo // Test details component > TestDetails.tsx
echo // Variable manager component > VariableManager.tsx
cd ..

mkdir runner
cd runner
echo // Execution controls component > ExecutionControls.tsx
echo // Live logs component > LiveLogs.tsx
echo // Test selector component > TestSelector.tsx
echo // Test status component > TestStatus.tsx
cd ..

mkdir reports
cd reports
echo // Dashboard component > Dashboard.tsx
echo // Metrics card component > MetricsCard.tsx
echo // Test result details component > TestResultDetails.tsx
echo // Test results list component > TestResultsList.tsx
cd ..
cd ..

REM Create pages directory
mkdir pages
cd pages
echo // Home page > HomePage.tsx
echo // Recorder page > RecorderPage.tsx
echo // Editor page > EditorPage.tsx
echo // Runner page > RunnerPage.tsx
echo // Reports page > ReportsPage.tsx
echo // Settings page > SettingsPage.tsx
cd ..

REM Create services directory
mkdir services
cd services
echo // Core API service > api.ts
echo // Recording service > recordingService.ts
echo // Code generation service > codeGenerationService.ts
echo // Test execution service > executionService.ts
echo // Project management service > projectService.ts
echo // Reporting service > reportService.ts
echo // File system service > fileSystemService.ts
cd ..

REM Create utils directory
mkdir utils
cd utils
echo // Browser-related utilities > browserUtils.ts
echo // Code formatting utilities > codeFormatter.ts
echo // Element finding utilities > elementFinder.ts
echo // Locator generation utilities > locatorUtils.ts
echo // Test data utilities > testDataUtils.ts
cd ..

REM Create store directory
mkdir store
cd store
echo // Store configuration > index.ts
mkdir actions
cd actions
echo // Recording actions > recordingActions.ts
echo // Project actions > projectActions.ts
echo // Execution actions > executionActions.ts
echo // UI actions > uiActions.ts
cd ..
mkdir reducers
cd reducers
echo // Recording reducer > recordingReducer.ts
echo // Project reducer > projectReducer.ts
echo // Execution reducer > executionReducer.ts
echo // UI reducer > uiReducer.ts
cd ..
cd ..

REM Create contexts directory
mkdir contexts
cd contexts
echo // Recorder context > RecorderContext.tsx
echo // Project context > ProjectContext.tsx
echo // User context > UserContext.tsx
cd ..

REM Create hooks directory
mkdir hooks
cd hooks
echo // Recording hook > useRecording.ts
echo // Test execution hook > useTestExecution.ts
echo // Code generation hook > useCodeGeneration.ts
cd ..

REM Create types directory
mkdir types
cd types
echo // Recorder-related types > recorderTypes.ts
echo // Project-related types > projectTypes.ts
echo // Execution-related types > executionTypes.ts
echo // Report-related types > reportTypes.ts
cd ..
cd ..
cd ..

REM Return to root and create backend directories
cd ..
mkdir backend
cd backend
echo <!-- Backend Maven module --> > pom.xml

mkdir src
cd src
mkdir main
cd main
mkdir java
cd java
mkdir com
cd com
mkdir cstestforge
cd cstestforge
echo // Main application class > CSTestForgeApplication.java

mkdir config
cd config
echo // Web configuration > WebConfig.java
echo // Security configuration > SecurityConfig.java
echo // WebSocket configuration > WebSocketConfig.java
cd ..

mkdir controller
cd controller
echo // Recorder controller > RecorderController.java
echo // Code generation controller > CodeGenerationController.java
echo // Test execution controller > TestExecutionController.java
echo // Project controller > ProjectController.java
echo // Report controller > ReportController.java
cd ..

mkdir service
cd service

mkdir recorder
cd recorder
echo // Recorder service interface > RecorderService.java
echo // Recorder service implementation > RecorderServiceImpl.java
echo // Browser session service > BrowserSessionService.java
echo // Event capture service > EventCaptureService.java
echo // WebSocket handler > RecorderWebSocketHandler.java
cd ..

mkdir ai
cd ai
echo // Element recognition service > ElementRecognitionService.java
echo // Smart locator service > SmartLocatorService.java
echo // Code optimization service > CodeOptimizationService.java
cd ..

mkdir codegen
cd codegen
echo // Code generation service > CodeGenerationService.java
echo // TestNG code generator > TestNGCodeGenerator.java
echo // BDD code generator > BDDCodeGenerator.java
echo // Page object generator > PageObjectGenerator.java
echo // Framework generator > FrameworkGenerator.java
cd ..

mkdir execution
cd execution
echo // Test execution service > TestExecutionService.java
echo // Selenium executor > SeleniumExecutor.java
echo // Playwright executor > PlaywrightExecutor.java
cd ..

mkdir project
cd project
echo // Project service > ProjectService.java
echo // File system service > FileSystemService.java
echo // Export service > ExportService.java
cd ..

mkdir report
cd report
echo // Report service > ReportService.java
echo // Test result processor > TestResultProcessor.java
echo // Metrics service > MetricsService.java
cd ..
cd ..

mkdir model
cd model

mkdir common
cd common
echo // API response wrapper > ApiResponse.java
cd ..

mkdir recorder
cd recorder
echo // Recording session model > RecordingSession.java
echo // Recording event model > RecordingEvent.java
echo // Recording event batch model > RecordingEventBatch.java
echo // Element information model > ElementInfo.java
echo // Browser information model > BrowserInfo.java
echo // Recording request model > RecordingRequest.java
echo // Recording result model > RecordingResult.java
cd ..

mkdir codegen
cd codegen
echo // Code generation request model > CodeGenerationRequest.java
echo // Generated test model > GeneratedTest.java
echo // Test step model > TestStep.java
echo // Page object model > PageObject.java
cd ..

mkdir execution
cd execution
echo // Execute test request model > ExecuteTestRequest.java
echo // Test execution result model > TestExecutionResult.java
echo // Test case result model > TestCaseResult.java
echo // Test step result model > TestStepResult.java
echo // Execution metrics model > ExecutionMetrics.java
cd ..

mkdir project
cd project
echo // Project model > Project.java
echo // Test file model > TestFile.java
echo // Test suite model > TestSuite.java
echo // Test case model > TestCase.java
echo // Project structure model > ProjectStructure.java
cd ..

mkdir report
cd report
echo // Test report model > TestReport.java
echo // Test case report model > TestCaseReport.java
echo // Step report model > StepReport.java
echo // Screenshot model > Screenshot.java
echo // Dashboard summary model > DashboardSummary.java
cd ..
cd ..

mkdir framework
cd framework

mkdir selenium
cd selenium
echo // Base test class > CSBaseTest.java
echo // Base page class > CSBasePage.java
echo // Element wrapper class > CSElement.java
echo // FindBy annotation > CSFindBy.java
echo // Wait strategy > CSWaitStrategy.java
echo // Test step interface > CSTestStep.java
echo // Custom reporter > CSReporter.java
cd ..

mkdir playwright
cd playwright
echo // Base test class > CSBaseTest.java
echo // Base page class > CSBasePage.java
echo // Element wrapper class > CSElement.java
echo // FindBy annotation > CSFindBy.java
echo // Wait strategy > CSWaitStrategy.java
echo // Test step interface > CSTestStep.java
echo // Custom reporter > CSReporter.java
cd ..
cd ..

mkdir util
cd util
echo // Browser utilities > BrowserUtils.java
echo // Code formatting utilities > CodeFormatter.java
echo // Element finding utilities > ElementFinder.java
echo // Locator utilities > LocatorUtils.java
echo // Test data utilities > TestDataUtils.java
cd ..
cd ..
cd ..

mkdir resources
cd resources
echo # Application properties > application.properties
echo # Development properties > application-dev.properties
echo # Production properties > application-prod.properties

mkdir static
cd static
mkdir js
cd js
echo // Recorder injector script > recorder-injector.js
cd ..
mkdir css
cd ..
cd ..

mkdir templates
cd templates

mkdir codegen
cd codegen

mkdir selenium
cd selenium
mkdir java
cd java
echo ## Selenium Java TestNG template > testng.vm
echo ## Selenium Java BDD template > bdd.vm
cd ..
mkdir typescript
cd typescript
echo ## Selenium TypeScript TestNG template > testng.vm
echo ## Selenium TypeScript BDD template > bdd.vm
cd ..
cd ..

mkdir playwright
cd playwright
mkdir java
cd java
echo ## Playwright Java TestNG template > testng.vm
echo ## Playwright Java BDD template > bdd.vm
cd ..
mkdir typescript
cd typescript
echo ## Playwright TypeScript TestNG template > testng.vm
echo ## Playwright TypeScript BDD template > bdd.vm
cd ..
cd ..
cd ..

mkdir reports
cd reports
echo ## HTML report template > html-report.vm
echo ## PDF report template > pdf-report.vm
echo ## XML report template > xml-report.vm
cd ..
cd ..
cd ..
cd ..

mkdir test
cd test
mkdir java
cd java
mkdir com
cd com
mkdir cstestforge
cd cstestforge
mkdir controller
mkdir service
mkdir util
cd ..
cd ..
cd ..
cd ..
cd ..
cd ..
cd ..

REM Create docs directory
mkdir docs
cd docs
mkdir architecture
mkdir api
mkdir user-guide
mkdir development-guide
cd ..

echo CSTestForge project structure created successfully!
pause
