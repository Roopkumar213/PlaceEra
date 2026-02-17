# Daily Learning Engine - Testing Guide

## Feature Branch
`feature/daily-learning-core`

## What Was Built

### Backend Components

1. **DailyConcept Model** (`backend/src/models/DailyConcept.js`)
   - Stores daily lesson content
   - Fields: date, subject, topic, difficulty, summary, explanation, codeExample, quiz
   - Unique constraint on date (one lesson per day)

2. **Task Routes** (`backend/src/routes/taskRoutes.js`)
   - `GET /api/today` - Returns today's lesson
   - Auto-generates placeholder content if no lesson exists
   - Uses weekday rotation to select topics from predefined list

3. **Topic Rotation System**
   - 7 topics rotating based on day of month
   - Subjects: DSA, Backend, Aptitude, Core CS
   - Auto-creates placeholder lessons with sample quiz

### Frontend Components

1. **Today Page** (`frontend/src/pages/Today.tsx`)
   - Structured lesson layout with clear visual hierarchy
   - Sections:
     - Subject badge & difficulty indicator
     - Topic title
     - Summary block
     - Detailed explanation (supports HTML)
     - Code example block (syntax highlighted)
     - Interactive quiz with radio buttons
     - Submit quiz functionality
     - Complete session button

2. **Route Integration**
   - Added `/today` as protected route
   - Accessible only when authenticated

## API Response Example

```json
{
  "_id": "65f1234567890abcdef12345",
  "date": "2026-02-16T00:00:00.000Z",
  "subject": "DSA",
  "topic": "Arrays & Hashing",
  "difficulty": "Medium",
  "summary": "Today we are focusing on Arrays & Hashing in DSA. This is a crucial concept for placement interviews.",
  "explanation": "<h3>Understanding Arrays & Hashing</h3><p>This concept is fundamental to solving efficient problems...</p>",
  "codeExample": {
    "language": "javascript",
    "code": "// Sample implementation for Arrays & Hashing\n\nfunction solve(input) {\n  // Implementation logic here\n  return result;\n}"
  },
  "quiz": [
    {
      "question": "What is the primary benefit of Arrays & Hashing?",
      "options": ["Efficiency", "Complexity", "Redundancy", "Styles"],
      "correctAnswer": "Efficiency"
    },
    {
      "question": "Which complexity class does this typically fall into?",
      "options": ["O(1)", "O(n)", "O(n^2)", "O(log n)"],
      "correctAnswer": "O(n)"
    },
    {
      "question": "True or False: This is commonly asked in FAANG interviews?",
      "options": ["True", "False"],
      "correctAnswer": "True"
    }
  ],
  "createdAt": "2026-02-16T16:48:20.123Z"
}
```

## Manual Testing Steps

### 1. Start Backend Server
```bash
cd backend
npm run dev
```
Server should start on port 5000.

### 2. Start Frontend Dev Server
```bash
cd frontend
npm run dev
```
Frontend should start on port 5173 (or next available).

### 3. Test Authentication
1. Navigate to `http://localhost:5173`
2. Click "Start Training" or "Login"
3. Login with existing credentials or register new account

### 4. Test Today Page
1. After login, navigate to `/today` manually: `http://localhost:5173/today`
2. Verify the page loads with today's lesson
3. Check all sections render correctly:
   - ✅ Subject badge shows (e.g., "DSA")
   - ✅ Difficulty badge shows (e.g., "Medium")
   - ✅ Topic title displays
   - ✅ Summary section visible
   - ✅ Explanation section visible
   - ✅ Code example block visible
   - ✅ Quiz questions display with radio buttons

### 5. Test Quiz Interaction
1. Select answers for all 3 questions
2. Click "Submit Quiz"
3. Verify:
   - ✅ Correct answers highlighted in green
   - ✅ Incorrect selections highlighted in red
   - ✅ Radio buttons become disabled
   - ✅ "Complete Session" button appears

### 6. Test API Directly
```bash
# Get auth token first (login via frontend or use existing token)
# Then test the endpoint:

curl -H "x-auth-token: YOUR_TOKEN_HERE" http://localhost:5000/api/today
```

### 7. Test Auto-Generation
1. Check MongoDB to see if DailyConcept was created
2. Refresh `/today` page - should return same content (not create duplicate)
3. Change system date to tomorrow (optional) - should create new concept

## Expected UI Layout Description

### Header
- Sticky top bar with ELEVARE logo
- "Today's Lesson" title
- Current date (e.g., "Saturday, Feb 16")
- "← Back to Dashboard" link

### Main Content (Centered, max-width 5xl)

1. **Topic Header**
   - Purple badge: Subject name (DSA/Backend/Aptitude/Core CS)
   - Colored badge: Difficulty (Green=Easy, Orange=Medium, Red=Hard)
   - Large title: Topic name

2. **Summary Card** (Glass panel)
   - Book icon + "Summary" heading
   - Gray text paragraph

3. **Explanation Card** (Glass panel)
   - "Detailed Explanation" heading
   - HTML-rendered content with proper styling

4. **Code Example Card** (Glass panel)
   - Code icon + "Code Example" heading
   - Language badge (top-right)
   - Black code block with monospace font

5. **Quiz Card** (Glass panel)
   - Checkmark icon + "Knowledge Check" heading
   - 3 numbered questions
   - Radio button options
   - Submit button (disabled until all answered)

6. **Complete Session** (Appears after quiz submission)
   - Large gradient button
   - Centered with glow effect

## Known Limitations (Phase 1)

- ❌ No AI content generation (placeholder text only)
- ❌ No session completion tracking in database
- ❌ No score calculation or storage
- ❌ No streak tracking integration
- ❌ No navigation from Dashboard to Today page (manual URL entry required)

## Next Phase Requirements

- Integrate AI for content generation
- Add session completion API
- Track quiz scores and performance
- Link from Dashboard "Daily Tasks" section
- Add progress persistence
- Implement adaptive revision scheduling

## Troubleshooting

### "Failed to load today's lesson"
- Check backend is running on port 5000
- Verify MongoDB connection is active
- Check browser console for CORS errors
- Verify auth token is valid

### Quiz not submitting
- Ensure all 3 questions have selected answers
- Check browser console for errors

### Blank page
- Check frontend dev server is running
- Verify route is registered in App.tsx
- Check browser console for import errors
