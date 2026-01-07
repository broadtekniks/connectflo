# Extension Assignment UI Update

## Overview

Updated the Extensions tab in Settings to support admin-managed extension assignment with team member selection dropdown instead of self-service assignment.

## Changes Made

### 1. State Management Updates

**File:** `pages/Settings.tsx`

**Removed:**

- `myExtension` - User's own extension number
- `myExtensionLabel` - User's own extension label

**Added:**

- `teamMembers` - Array of all team members for dropdown selection
- `selectedUserId` - Currently selected team member's ID
- `assignExtension` - Extension number to assign
- `assignExtensionLabel` - Extension label to assign

### 2. Data Loading

**Updated `useEffect`:**

- Now loads both extensions AND team members
- Fetches team members from `/api/team-members` endpoint
- Removes auto-population of current user's extension

### 3. Handler Functions

**Renamed and Updated:**

- `handleSaveMyExtension()` → `handleAssignExtension()`
  - Now uses `selectedUserId` instead of hardcoded `user.id`
  - Resets form after successful assignment
- `handleRemoveMyExtension()` → `handleRemoveExtension(userId: string)`
  - Now accepts `userId` parameter for removing any team member's extension
  - No longer resets `myExtension` state variables

**New Handler:**

- `handleTeamMemberSelect(userId: string)`
  - Pre-fills form when team member is selected
  - Loads existing extension data if member already has one
  - Clears form if member doesn't have an extension

### 4. UI Changes

#### Assignment Section (formerly "My Extension")

**New Features:**

- **Team Member Dropdown:** Shows all team members with their email addresses
- **Extension Display:** Shows current extension number next to member name in dropdown
- **Context-Aware Labels:**
  - Button text: "Assign Extension" (instead of "Save Extension")
  - Section title: "Assign Extension" (instead of "My Extension")
- **Conditional Remove Button:** Only shows if selected member has an existing extension

**Improved UX:**

- Form auto-populates when selecting a team member who already has an extension
- Extension and label fields disabled until a team member is selected
- Clear visual indication of which members already have extensions

#### Extension Directory Section

**New Features:**

- **Edit Button:** Click to load member's data into assignment form and scroll to top
- **Remove Button:** Inline delete action for each extension
- **Hover Effects:** Cards now have hover state for better interactivity
- **Better Layout:** Actions grouped on the right side with proper spacing

**Button Behaviors:**

- Edit: Loads extension data into form and scrolls to top
- Remove: Immediately removes extension with confirmation modal
- Both buttons disabled during save/delete operations

### 5. Workflow Improvements

**Old Workflow (Self-Service):**

1. User enters their own extension
2. User saves
3. Only affects current user

**New Workflow (Admin-Managed):**

1. Admin selects team member from dropdown
2. Form auto-fills if member has extension (edit mode)
3. Admin modifies or enters new extension
4. Admin clicks "Assign Extension"
5. Form resets, ready for next assignment

**Alternative Edit Flow:**

1. Admin clicks "Edit" on any extension in directory
2. Form auto-fills with member's data
3. Page scrolls to top to show form
4. Admin makes changes and saves

## API Endpoints Used

### Existing (No Changes Required)

- `GET /api/extensions` - Lists all tenant extensions ✅
- `POST /api/extensions/assign` - Assigns extension (already accepted `userId` parameter) ✅
- `DELETE /api/extensions/:userId` - Removes extension ✅
- `GET /api/team-members` - Lists all team members (assumed to exist) ⚠️

## Benefits

### Fixes Reported Issues

1. ✅ **No More Overwrites:** Form now clearly shows if member has existing extension
2. ✅ **Team Member Selection:** Dropdown shows all team members for assignment
3. ✅ **Not Auto-Assigned:** Admins explicitly select who gets which extension

### Additional Improvements

- Better UX with auto-fill on selection
- Inline editing from directory
- Clear visual feedback on existing assignments
- Smooth scrolling to form on edit
- Prevents accidental overwrites by showing current state

## Testing Checklist

- [ ] Team members load in dropdown
- [ ] Selecting member with extension pre-fills form
- [ ] Selecting member without extension clears form
- [ ] Assigning new extension works
- [ ] Updating existing extension works (no overwrite)
- [ ] Remove button removes extension
- [ ] Edit button loads data and scrolls to top
- [ ] Form resets after successful assignment
- [ ] Extension directory updates after changes
- [ ] All buttons disable during operations
- [ ] Validation works (3-4 digit requirement)

## Next Steps

1. Verify `/api/team-members` endpoint exists and returns correct data structure
2. Test the full workflow with multiple team members
3. Consider adding confirmation modal for remove actions
4. Add search/filter for team member dropdown if list is large

## Notes

- Backend API already supported `userId` parameter in assignment endpoint
- No backend changes required
- All changes are frontend-only
- Maintains backward compatibility with extension directory display
