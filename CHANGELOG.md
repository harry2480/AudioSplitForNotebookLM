# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### 🐛 Fixed
- **要約履歴表示**: 議事録生成後に要約履歴に反映されない問題を修正
  - localStorage のキー不一致を解消（`summaryHistory` を使用するように統一）
  - 後方互換性のため古いキー (`transcription-history`) からのフォールバック読み込みを実装

## [2.0.0] - 2024-12-XX

### 🎉 Major Release: Complete UI/UX Redesign & Enhanced Features

This major release represents a complete overhaul of the user interface and experience, with significant new features and improvements across the entire application.

### ✨ Added

#### 🧭 Smart Navigation System
- **Header-integrated Navigation**: Step progress indicator in compact header
- **Auto Step Detection**: Automatic current step highlighting based on scroll position
- **One-click Navigation**: Smooth scroll jump to any available step
- **Step Status Indicators**: Visual available/locked state display
- **Mobile Responsive**: Adaptive design for small screens

#### 🎨 Modern UI/UX Enhancements
- **Flow Visualization**: Animated arrows between workflow steps
- **Input/Output Sections**: Clear separation of settings and results in each step
- **Unified Regeneration Buttons**: Consistent re-run buttons between sections
- **Real-time Cost Display**: Live API usage cost estimation
- **Glass Morphism Design**: Semi-transparent blur effects throughout

#### 🎙️ Enhanced Recording Features
- **Recording State Indicators**: Dynamic favicon and page title changes during recording
- **Visual Recording Feedback**: Clear visual cues for recording status
- **Improved Recording Panel**: Streamlined interface with essential controls
- **Device Management**: Better microphone device selection interface

#### 📝 Advanced Transcription & Summary
- **Consolidated Settings**: Unified settings panel without redundant sections
- **Persistent Background Info**: Settings maintained across re-runs
- **Enhanced Progress Display**: Detailed file-by-file processing status
- **Input/Output Structure**: Organized transcription results with clear categorization
- **Extended Preview**: Expandable transcription preview (up to 100 lines)

#### 🔧 Technical Improvements
- **State Management**: Enhanced component communication via callbacks
- **Memory Management**: Improved resource cleanup and garbage collection
- **Error Handling**: Better error recovery and partial success handling
- **Performance Optimization**: Reduced memory usage and faster processing

### 🔄 Changed

#### Interface Restructuring
- **Card Spacing**: Increased spacing between workflow steps (mb-8 → mb-16)
- **Section Organization**: Reorganized summary step to remove nested card appearance
- **Button Layout**: Centered regeneration buttons with cost display below
- **Border Removal**: Simplified regeneration button areas without unnecessary borders

#### Content & Messaging
- **Completion Messages**: Removed redundant "お疲れさまでした" completion messages
- **Step Naming**: Unified step naming from "まとめ" to "要約作成" for consistency
- **Button Text**: Improved button labeling for better clarity

#### Processing Flow
- **Input Section Visibility**: Transcription settings remain visible during processing
- **Progress Integration**: Processing status shown alongside input settings
- **Background Info Persistence**: Settings preserved for re-runs as expected

### 🗑️ Removed

#### Deprecated Components
- **Standalone Step Navigator**: Replaced with header-integrated navigation
- **Redundant UI Elements**: Simplified interface by removing unnecessary visual noise
- **Duplicate Download Buttons**: Consolidated download options with clear categorization

#### Redundant Functionality
- **Nested Card Layouts**: Removed double-card appearance in summary section
- **Excessive Borders**: Simplified visual hierarchy by removing unnecessary borders
- **Completion Messaging**: Removed redundant success/completion messages

### 🛠️ Fixed

#### TypeScript Issues
- **Import Cleanup**: Removed unused imports (Info, Key, downloadTranscription)
- **Variable Cleanup**: Removed unused variables and state setters
- **Type Safety**: Improved type definitions and prop interfaces

#### UI/UX Issues
- **Button Alignment**: Fixed regeneration button centering issues
- **Visual Hierarchy**: Improved information organization and flow
- **State Consistency**: Fixed step navigation state synchronization
- **Download Organization**: Clarified distinction between audio files and transcription results

#### Processing Issues
- **Memory Leaks**: Enhanced automatic memory cleanup
- **State Persistence**: Fixed background info persistence across re-runs
- **Progress Display**: Improved real-time processing status updates

### 🔧 Technical Details

#### Architecture Changes
```
App.tsx
├── State Management: Enhanced step state communication
├── HeroSection: Integrated navigation functionality
└── TranscribePage: Improved component organization

Components Structure:
- Header Navigation: Real-time step tracking
- Workflow Cards: Unified input/output sections
- Progress Indicators: Enhanced visual feedback
```

#### New Dependencies
- **Lucide React Icons**: Upload, Settings, FileAudio, Sparkles for navigation
- **Enhanced State Types**: StepState interface for component communication

#### Performance Improvements
- **Component Optimization**: Reduced re-renders through better state management
- **Memory Management**: Improved cleanup and resource management
- **Scroll Performance**: Optimized scroll event handling for navigation

### 📊 Statistics

- **Lines Changed**: ~1,500 lines across 15+ files
- **New Components**: Header-integrated navigation system
- **Removed Components**: Standalone StepNavigator (196 lines removed)
- **UI Improvements**: 20+ visual enhancements
- **Type Safety**: 100% TypeScript compilation success

### 🔄 Migration Guide

#### For Users
- **Navigation**: Use header navigation instead of sidebar for step jumping
- **Settings**: All summary settings now in single unified section
- **Downloads**: Improved categorization - look for clearly labeled sections

#### For Developers
- **Component Updates**: StepNavigator removed, functionality moved to HeroSection
- **State Management**: New callback-based state communication pattern
- **Styling**: Updated Tailwind classes for new design system

---

## [1.9.0] - 2024-11-XX

### Added
- Initial recording functionality with dual audio capture
- Recording panel with device selection
- Real-time audio level monitoring
- Basic transcription and summary features

### Changed
- Improved audio splitting algorithm
- Enhanced error handling
- Better mobile responsiveness

### Fixed
- Memory management issues with large files
- Audio processing errors
- UI responsiveness problems

---

## [1.8.0] - 2024-10-XX

### Added
- Gemini API integration for transcription
- Multiple summary format presets
- Background information input for accuracy improvement
- Cost estimation for API usage

### Changed
- Moved from single-page to multi-step workflow
- Improved file upload interface
- Enhanced progress tracking

### Fixed
- Audio codec compatibility issues
- Large file processing stability
- API error handling

---

## [1.7.0] - 2024-09-XX

### Added
- Web Audio API primary processing engine
- FFmpeg.wasm fallback support
- Automatic engine selection
- Memory optimization features

### Changed
- Complete audio processing engine rewrite
- Improved performance for large files
- Better error recovery mechanisms

### Fixed
- Memory leaks with repeated processing
- Audio quality degradation issues
- Browser compatibility problems

---

## [1.6.0] - 2024-08-XX

### Added
- Multiple output formats (WAV, MP3 compatibility)
- Batch processing capabilities
- Download progress indicators
- File size validation

### Changed
- Enhanced UI with progress bars
- Improved error messages
- Better mobile layout

### Fixed
- Download failures for large files
- Progress tracking accuracy
- File naming conflicts

---

## [1.5.0] - 2024-07-XX

### Added
- Drag and drop file upload
- ZIP batch download
- Processing cancellation
- File size optimization

### Changed
- Redesigned upload interface
- Improved processing feedback
- Better error handling

### Fixed
- Upload reliability issues
- Processing timeout problems
- Memory usage optimization

---

## [1.0.0] - 2024-06-XX

### Added
- Initial release
- Basic audio splitting functionality
- Size-based and count-based splitting
- WAV output format
- Web-based processing

### Features
- Client-side audio processing
- No server dependency
- Privacy-focused design
- NotebookLM integration support

---

## Development Notes

### Versioning Strategy
- **Major** (X.0.0): Breaking changes, complete redesigns
- **Minor** (x.Y.0): New features, significant improvements
- **Patch** (x.y.Z): Bug fixes, small improvements

### Release Schedule
- Major releases: Every 6 months
- Minor releases: Monthly
- Patch releases: As needed

### Support Policy
- Current major version: Full support
- Previous major version: Security updates only
- Older versions: Community support only