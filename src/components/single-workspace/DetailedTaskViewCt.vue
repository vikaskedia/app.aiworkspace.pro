<template>
  <div class="single-task-view" v-if="task">
    <div class="task-header">
      <div class="back-button">
        <router-link 
          :to="`/single-workspace/${currentWorkspace?.id}/tasks`"
          class="back-link">
          <el-icon><ArrowLeft /></el-icon>
          Back to Tasks
        </router-link>
      </div>
      <div class="header-actions">
        <el-button 
          type="primary"
          @click="showCreateTaskDialog"
          size="small"
          class="create-task-btn"
          title="Create New Task">
          <el-icon><Plus /></el-icon>
        </el-button>
        <el-button 
          type="success"
          @click="showMoveToDialog"
          size="small"
          class="move-to-btn"
          title="Move to Workspace">
          <el-icon><Position /></el-icon>
        </el-button>
        <el-button 
          type="info"
          @click="shareDialogVisible = true"
          size="small"
          class="share-task-btn">
          <el-icon><Share /></el-icon>
          <span class="share-task-text">Share Task</span>
        </el-button>
        <el-button 
          type="warning"
          @click="logHoursDialogVisible = true"
          size="small"
          class="log-hours-btn">
          <el-icon><Clock /></el-icon>
          <span class="log-hours-text">Log Hours</span>
        </el-button>
      </div>
    </div>

    <div class="task-content-wrapper">
      <!-- Main Content -->
      <div class="task-main-content">
        <div class="task-main-info">
          
          <div class="task-title-header">
            <div class="title-main-section">
              <div class="title-wrapper">
                <div class="star-container">
                  <el-icon 
                    class="star-icon"
                    :class="{ 'starred': isTaskStarred }"
                    @click.stop="toggleTaskStar"
                  >
                    <Star v-if="!isTaskStarred" />
                    <StarFilled v-else />
                  </el-icon>
                </div>
                
                <!-- Loading indicator for task title -->
                <div v-if="loading" class="loading-message">
                  <el-icon class="loading-spinner"><Loading /></el-icon>
                  <span>Loading task details...</span>
                </div>
                
                <h2 
                  v-else-if="!isEditingTitle" 
                  @click="startTitleEdit"
                  class="editable-title"
                >
                  {{ task?.title }}
                  <el-icon class="edit-icon"><Edit /></el-icon>
                </h2>
                
                <div v-else class="title-edit-wrapper">
                  <el-input
                    v-model="editingTitle"
                    ref="titleInput"
                    size="large"
                    @keyup.enter="saveTitleEdit"
                    @keyup.esc="cancelTitleEdit"
                  />
                  <div class="title-edit-actions">
                    <el-button @click="cancelTitleEdit" size="small">Cancel</el-button>
                    <el-button 
                      type="primary" 
                      @click="saveTitleEdit" 
                      size="small"
                      :loading="savingTitle"
                      :disabled="!editingTitle.trim() || editingTitle === task?.title"
                    >
                      Save
                    </el-button>
                  </div>
                </div>
              </div>
            </div>

            <div class="edit-metadata">
              <span 
                v-if="task?.edit_history?.length" 
                class="edited-marker"
                @click="toggleTaskHistory"
              >
                (edited {{ task.edit_history.length }} times)
              </span>
            </div>
          </div>

          <!-- Parent/Child Buttons Condensed Row -->
          <template v-if="!loading">
            <template v-if="!task.parent_task_id && !sortedChildTasks.length">
              <div class="parent-child-actions-row">
                <el-button type="text" size="small" class="set-parent-link" @click="showParentSelector = true">
                  <el-icon><Plus /></el-icon> Set Parent Task
                </el-button>
                <el-button type="text" size="small" class="set-parent-link" @click="createChildTaskDialogVisible = true">
                  <el-icon><Plus /></el-icon> Add Child Task
                </el-button>
              </div>
            </template>
            <template v-else>
              <div class="task-parent-condensed">
                <template v-if="task.parent_task_id">
                  <div class="parent-label">Parent Task:</div>
              <el-select
                v-model="task.parent_task_id"
                filterable 
                placeholder="Select parent task"
                @change="updateParentTask"
                    size="small"
                    class="parent-select-condensed"
              >
                <el-option
                  v-for="parentTask in flattenedTasks"
                  :key="parentTask.id ?? 'no-parent'"
                  :label="parentTask.title"
                  :value="parentTask.id ?? ''"
                />
              </el-select>
              <el-button
                v-if="task.parent_task_id"
                type="primary"
                link
                    class="view-parent-btn-condensed"
                @click="navigateToTask(task.parent_task_id)"
                    size="small"
              >
                <el-icon><View /></el-icon>
              </el-button>
                </template>
                <template v-else>
                  <el-button type="text" size="small" class="set-parent-link" @click="showParentSelector = true">
                    <el-icon><Plus /></el-icon> Set Parent Task
                  </el-button>
                </template>
            </div>
              <!-- If there are no child tasks, show Add Child Task button below parent section -->
              <div v-if="!sortedChildTasks.length" class="add-child-task-row">
                <el-button type="text" size="small" class="set-parent-link" @click="createChildTaskDialogVisible = true">
                  <el-icon><Plus /></el-icon> Add Child Task
                </el-button>
          </div>
            </template>
          </template>
          <!-- Always render the Set Parent Task dialog so it works in all cases -->
          <el-dialog v-model="showParentSelector" title="Set Parent Task" width="400px">
            <el-select
              v-model="task.parent_task_id"
              filterable
              placeholder="Select parent task"
              @change="updateParentTask"
              style="width: 100%"
            >
              <el-option
                v-for="parentTask in flattenedTasks"
                :key="parentTask.id ?? 'no-parent'"
                :label="parentTask.title"
                :value="parentTask.id ?? ''"
              />
            </el-select>
          </el-dialog>
          <!-- Child Tasks Section (Condensed) -->
          <div class="task-children-condensed" v-if="!loading && sortedChildTasks.length">
            <div class="child-tasks-header-section-condensed">
              <span class="child-tasks-title">Child Tasks</span>
              <el-button 
                type="text" 
                size="small"
                @click="createChildTaskDialogVisible = true"
                class="create-child-btn-condensed"
                :loading="creatingChildTask">
                <el-icon><Plus /></el-icon>
                Add Child Task
              </el-button>
            </div>
            <div class="child-tasks-table-condensed">
              <div class="child-tasks-header-condensed">
                <div class="column-description sortable-column" @click="sortBy('title')" :class="{ 'active': sortColumn === 'title' }">
                  Description
                  <el-icon v-if="sortColumn === 'title'" class="sort-icon">
                    <ArrowUp v-if="sortDirection === 'asc'" />
                    <ArrowDown v-else />
                  </el-icon>
                </div>
                <div class="column-status sortable-column" @click="sortBy('status')" :class="{ 'active': sortColumn === 'status' }">
                  <span class="column-title">Status</span>
                    <el-icon v-if="sortColumn === 'status'" class="sort-icon">
                      <ArrowUp v-if="sortDirection === 'asc'" />
                      <ArrowDown v-else />
                    </el-icon>
                        </div>
                <div class="column-priority sortable-column" @click="sortBy('priority')" :class="{ 'active': sortColumn === 'priority' }">
                  Priority
                  <el-icon v-if="sortColumn === 'priority'" class="sort-icon">
                    <ArrowUp v-if="sortDirection === 'asc'" />
                    <ArrowDown v-else />
                  </el-icon>
                </div>
              </div>
              <div 
                v-for="childTask in sortedChildTasks" 
                :key="childTask.id" 
                class="child-task-row-condensed"
                :class="{ 'updating': updatingChildTasks.has(childTask.id) }"
              >
                <div class="column-description">
                  <a 
                    class="child-task-title" 
                    :href="`/single-workspace/${currentWorkspace.id}/tasks/${childTask.id}`"
                    :style="{ paddingLeft: getTaskIndentation(childTask) + 'px' }"
                  >
                    {{ childTask.title }}
                  </a>
                </div>
                <div class="column-status">
                  <el-tag :type="getStatusType(childTask)" size="small">
                        {{ formatStatus(childTask.status) }}
                        </el-tag>
                </div>
                <div class="column-priority">
                  <el-tag :type="getPriorityType(childTask)" size="small">
                        {{ formatPriority(childTask.priority) }}
                        </el-tag>
                      </div>
                    </div>
                </div>
          </div>



          <div v-if="showTaskHistory && !loading" class="edit-history">
            <div 
              v-for="(historyEntry, index) in task?.edit_history?.slice().reverse()" 
              :key="index" 
              class="edit-history-entry"
            >
              <div class="edit-history-header">Changed {{ historyEntry.field_name }}:</div>
              <div class="previous-content">
                {{ historyEntry.previous_value || 'No previous content' }}
              </div>
              <div class="edit-metadata">
                Edited by {{ userEmails[historyEntry.edited_by] }}
                on {{ new Date(historyEntry.edited_at).toLocaleString(undefined, {
                  year: 'numeric',
                  month: 'numeric',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                }) }}
              </div>
            </div>
          </div>

          <!-- Compact Task Metadata Section -->
          <div class="task-metadata-compact" v-if="!loading">
            <div class="metadata-row-compact">
              <div class="metadata-item-compact">
                <el-icon><CircleCheck /></el-icon>
                <span>Status</span>
                <el-popover
                  placement="bottom-start"
                  trigger="click"
                  :width="180"
                  popper-class="metadata-popover-compact"
                >
                  <template #reference>
                    <el-tag size="small" class="clickable-tag-compact">{{ formatStatus(task?.status) }}</el-tag>
                  </template>
                  <div class="metadata-options-compact">
                    <div 
                      v-for="option in statusOptions" 
                      :key="option.value"
                      class="metadata-option-compact"
                      :class="{ 'selected': task?.status === option.value }"
                      @click="handleStatusChange(option.value)"
                    >
                      <el-tag :type="getStatusType({ status: option.value })" size="small">
                        {{ option.label }}
                      </el-tag>
                    </div>
                  </div>
                </el-popover>
              </div>
              <div class="metadata-item-compact">
                <el-icon><Warning /></el-icon>
                <span>Priority</span>
                <el-popover
                  placement="bottom-start"
                  trigger="click"
                  :width="180"
                  popper-class="metadata-popover-compact"
                >
                  <template #reference>
                    <el-tag size="small" class="clickable-tag-compact">{{ formatPriority(task?.priority) }}</el-tag>
                  </template>
                  <div class="metadata-options-compact">
                    <div 
                      v-for="option in priorityOptions" 
                      :key="option.value"
                      class="metadata-option-compact"
                      :class="{ 'selected': task?.priority === option.value }"
                      @click="handlePriorityChange(option.value)"
                    >
                      <el-tag :type="getPriorityType({ priority: option.value })" size="small">
                        {{ option.label }}
                      </el-tag>
                    </div>
                  </div>
                </el-popover>
              </div>
              <div class="metadata-item-compact">
                <el-icon><Calendar /></el-icon>
                <span>Due Date</span>
                <el-popover
                  placement="bottom"
                  trigger="click"
                  :width="200"
                  popper-class="due-date-popover-compact"
                  @show="initializeTempDueDate"
                >
                  <template #reference>
                    <span class="meta-value clickable-tag-compact">{{ task?.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date' }}</span>
                  </template>
                  <div class="due-date-editor-compact">
                    <el-date-picker
                      v-model="tempDueDate"
                      type="date"
                      placeholder="Select due date"
                      style="width: 100%"
                      size="small"
                      @change="handleDueDateChange"
                    />
                    <div class="due-date-actions-compact">
                      <el-button @click="clearDueDate" link size="small">Clear</el-button>
                    </div>
                  </div>
                </el-popover>
              </div>
              <div class="metadata-item-compact">
                <el-icon><User /></el-icon>
                <span>Assigned To</span>
                <el-select
                  v-model="task.assignee"
                  placeholder="Select assignee"
                  filterable
                  clearable
                  @change="handleAssigneeChange"
                  size="small"
                  class="assignee-select-compact"
                >
                  <el-option
                    v-for="user in sortedSharedUsers"
                    :key="user.id"
                    :label="user.email"
                    :value="user.id"
                  />
                </el-select>
              </div>
            </div>
          </div>
          <!-- Compact Description Box -->
          <div class="description-wrapper-compact" v-if="!loading">
            <div class="description-header-compact">
              <span class="desc-title">Description</span>
              <el-button 
                v-if="!isEditingDescription" 
                link 
                @click="startDescriptionEdit"
                size="small"
                class="desc-edit-btn"
              >
                <el-icon><Edit /></el-icon>
                Edit
              </el-button>
            </div>
            <div v-if="isEditingDescription" class="description-edit">
              <TiptapEditor
                v-model="editingDescription"
                placeholder="Add a description..."
                :autofocus="true" 
                :isTaskComment="false"
                :sharedUsers="sharedUsers"
                :taskId="String(task.id)"
                :taskTitle="task.title"
                :enable-typeahead="false"
              />
              <div class="description-edit-actions">
                <el-button @click="cancelDescriptionEdit" size="small">Cancel</el-button>
                <el-button 
                  type="primary" 
                  @click="saveDescriptionEdit" 
                  size="small"
                  :loading="savingDescription"
                  :disabled="!editingDescription.trim() || editingDescription === task?.description"
                >
                  Save
                </el-button>
              </div>
            </div>
            <p 
              v-else 
              class="description" 
              v-html="formatCommentContent(task?.description || 'No description provided')"
              @click="startDescriptionEdit"
            ></p>
          </div>
        </div>

        <!-- Loading indicator for metadata section -->
        <div v-if="loading" class="section-loading">
          <div class="section-loading-header">
            <el-icon class="loading-spinner"><Loading /></el-icon>
            <span>Loading task metadata...</span>
          </div>
        </div>

        <!-- Loading indicator for description section -->
        <div v-if="loading" class="section-loading">
          <div class="section-loading-header">
            <el-icon class="loading-spinner"><Loading /></el-icon>
            <span>Loading description...</span>
          </div>
        </div>

        <!-- Loading indicator for hours logs section -->
        <div v-if="loading" class="section-loading">
          <div class="section-loading-header">
            <el-icon class="loading-spinner"><Loading /></el-icon>
            <span>Loading hours logs...</span>
          </div>
        </div>

        <div class="hours-logs" v-if="hoursLogs.length && !loading">
          <div class="hours-header">
            <h3>Hours Logged</h3>
            <div class="total-hours">
              <el-tag type="success" size="large" effect="plain">
                <el-icon><Clock /></el-icon>
                <span class="total-time">Total Hours: {{ formatTotalTime }}</span>
              </el-tag>
            </div>
          </div>
          
          <el-table 
            :data="displayedHoursLogs" 
            style="width: 100%"
            :stripe="true"
            :border="true"
            class="hours-table"
            row-class-name="hours-table-row"
          >
            <el-table-column 
              prop="time_taken" 
              label="Time Logged" 
              width="140"
              align="center"
              fixed
            >
              <template #default="scope">
                <div class="time-wrapper">
                  <el-icon><Timer /></el-icon>
                  <span class="time-cell">{{ formatTime(scope.row.time_taken) }}</span>
                </div>
              </template>
            </el-table-column>

            <el-table-column 
              prop="comment" 
              label="Work Description"
              min-width="300"
              show-overflow-tooltip
            >
              <template #default="scope">
                <div class="comment-cell">
                  <span v-if="scope.row.comment">{{ scope.row.comment }}</span>
                  <span v-else class="no-comment">No description provided</span>
                </div>
              </template>
            </el-table-column>

            <el-table-column 
              label="Logged By" 
              width="200"
              align="center"
            >
              <template #default="scope">
                <el-tooltip 
                  :content="userEmails[scope.row.user_id]"
                  placement="top"
                  effect="light"
                >
                  <div class="user-wrapper">
                    <el-avatar 
                      :size="24" 
                      class="user-avatar"
                    >
                      {{ getInitials(userEmails[scope.row.user_id]) }}
                    </el-avatar>
                    <span class="user-cell">{{ formatEmail(userEmails[scope.row.user_id]) }}</span>
                  </div>
                </el-tooltip>
              </template>
            </el-table-column>

            <el-table-column 
              label="Date & Time" 
              width="200"
              align="center"
            >
              <template #default="scope">
                <el-tooltip 
                  :content="formatDateTime(scope.row.created_at)"
                  placement="top"
                  effect="light"
                >
                  <div class="date-wrapper">
                    <span class="date-cell">{{ formatDate(scope.row.created_at) }}</span>
                    <span class="time-stamp">{{ formatTimeOnly(scope.row.created_at) }}</span>
                  </div>
                </el-tooltip>
              </template>
            </el-table-column>
          </el-table>

          <div v-if="hoursLogs.length > 3" class="show-more-container">
            <el-button 
              link 
              type="primary" 
              @click="toggleShowMore"
              class="show-more-button"
            >
              {{ showAllLogs ? 'Show Less' : `Show More` }}
            </el-button>
          </div>
        </div>
      </div>

      <!-- Comments and Outline Tabs Section -->
      <div class="task-tabs-section">
        <el-tabs v-model="activeTab" class="task-tabs">
          <!-- Comments Tab -->
          <el-tab-pane label="Comments" name="comments">
            <template #label>
              <span class="tab-label">
                <el-icon><ChatDotRound /></el-icon>
                Comments
                <el-badge 
                  v-if="filteredComments.length" 
                  :value="filteredComments.length" 
                  class="tab-badge"
                />
              </span>
            </template>
            
            <div class="tab-content">
              <div class="comments-header">
                <el-dropdown trigger="click">
                  <el-button link>
                    <el-icon><Setting /></el-icon>
                  </el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item>
                        <div class="dropdown-item-content">
                          <el-switch
                            v-model="showSystemComments"
                            size="small"
                            active-text="Show system comments"
                          />
                        </div>
                      </el-dropdown-item>
                      <el-dropdown-item>
                        <div class="dropdown-item-content">
                          <el-switch
                            v-model="showArchivedComments"
                            size="small"
                            active-text="Show archived"
                            @change="loadComments"
                          />
                        </div>
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
              
              <div class="comments-list">
                <!-- Loading indicator for comments -->
                <div v-if="commentsLoading" class="loading-message">
                  <el-icon class="loading-spinner"><Loading /></el-icon>
                  <span>Loading comments...</span>
                </div>
                
                <div 
                  v-for="comment in filteredComments" 
                  :key="comment.id"
                  :class="[
                    'comment-item', `cid-${comment.id}`,
                    {
                      'ai-response': comment.type === 'ai_response',
                      'archived': comment.archived,
                      'system-comment': comment.type === 'activity'
                    }
                  ]"
                >
                  <div :class="['comment-content', comment.type === 'activity' ? 'activity' : '']">
                    <div class="comment-header">
                      <div class="comment-author-section">
                        <span class="comment-author">
                          {{ getCommentAuthor(comment) }}
                        </span>
                        <el-tag v-if="comment.external_user_email" type="info" size="small" class="external-tag">
                          External
                        </el-tag>
                      </div>
                      <div class="comment-actions">
                        <span class="comment-date">
                          {{ comment.updated_at 
                            ? new Date(comment.updated_at).toLocaleString(undefined, { 
                                year: 'numeric', 
                                month: 'numeric', 
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : new Date(comment.created_at).toLocaleString(undefined, {
                                year: 'numeric',
                                month: 'numeric',
                                day: 'numeric', 
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                          }}
                        </span>
                        <el-dropdown v-if="comment.type !== 'activity'" trigger="click">
                          <el-button link>
                            <el-icon><VerticalDotsIcon /></el-icon>
                          </el-button>
                          <template #dropdown>
                            <el-dropdown-menu>
                              <el-dropdown-item 
                                v-if="comment.user_id === currentUser?.id" 
                                @click="startEditing(comment)"
                              >
                                Edit
                              </el-dropdown-item>
                              <el-dropdown-item @click="toggleCommentHistory(comment)" v-if="comment.comment_edit_history?.length">
                                {{ expandedCommentHistories.has(comment.id) ? 'Close History' : `Show History (${comment.comment_edit_history.length})` }}
                              </el-dropdown-item>
                              <el-dropdown-item @click="toggleArchiveComment(comment)">
                                {{ comment.archived ? 'Unarchive' : 'Archive' }}
                              </el-dropdown-item>
                              <!-- Add download options for AI responses -->
                              <el-dropdown-item :class="`download-doc-item-${comment.id}`" @click="downloadResponse(comment, 'doc')">
                                <el-icon><Download /></el-icon>
                                Doc
                              </el-dropdown-item>
                              <el-dropdown-item :class="`download-pdf-item-${comment.id}`" @click="downloadResponse(comment, 'pdf')">
                                <el-icon><Download /></el-icon>
                                PDF
                              </el-dropdown-item>   
                            </el-dropdown-menu>
                          </template>
                        </el-dropdown>
                      </div>
                    </div>
                    <div class="comment-text">
                      <div v-if="editingCommentId === comment.id">
                        <TiptapEditor
                          v-model="editingCommentText"
                          placeholder="Edit your comment..."
                          :taskId="String(task.id)"
                          :taskTitle="task.title"
                          :sharedUsers="sharedUsers"
                          :isTaskComment="true"
                          :autofocus="true"
                          :enable-typeahead="false"
                        />
                        <div class="comment-edit-actions">
                          <el-button @click="cancelEditing" size="small">Cancel</el-button>
                          <el-button 
                            type="primary" 
                            @click="saveCommentEdit(comment)" 
                            size="small"
                            :loading="savingComment"
                            :disabled="!editingCommentText.trim() || editingCommentText === comment.content"
                          >
                            Save
                          </el-button>
                        </div>
                      </div>
                      <span v-else v-html="formatCommentContent(comment.content)"></span>
                      
                      <!-- Add this new history section -->
                      <div v-if="expandedCommentHistories.has(comment.id) && comment.comment_edit_history?.length" class="comment-history">
                        <div class="history-header">Edit History</div>
                        <div v-for="(historyEntry, index) in comment.comment_edit_history.slice().reverse()" 
                             :key="index" 
                             class="history-entry">
                          <div class="previous-content" v-html="renderHistoryContent(historyEntry.previous_content)"></div>
                          <div class="edit-metadata">
                            Edited by {{ userEmails[historyEntry.edited_by] }}
                            on {{ new Date(historyEntry.edited_at).toLocaleString(undefined, {
                              year: 'numeric',
                              month: 'numeric',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            }) }}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="comment-input">
                <TiptapEditor
                  v-model="newComment"
                  placeholder="Write a comment..."
                  :taskId="String(task.id)"
                  :taskTitle="task.title"
                  :sharedUsers="sharedUsers"
                  :isTaskComment="true"
                  :enable-typeahead="false"
                />
                <div class="comment-input-actions">
                  <el-button
                    type="primary"
                    :disabled="!newComment.trim()"
                    :loading="addingComment"
                    @click="addComment">
                    Add Comment
                  </el-button>
                  
                  <!-- Loading message when adding comment -->
                  <div v-if="addingComment" class="adding-comment-message">
                    <el-icon class="loading-spinner"><Loading /></el-icon>
                    <span>Adding comment...</span>
                  </div>
                </div>
              </div>
            </div>
          </el-tab-pane>

          <!-- Outline Tab -->
          <el-tab-pane label="Outline" name="outline">
            <template #label>
              <span class="tab-label">
                <el-icon><List /></el-icon>
                Outline
                <el-badge 
                  v-if="taskOutline.length" 
                  :value="taskOutline.length" 
                  class="tab-badge"
                />
              </span>
            </template>
            
            <div class="tab-content">
              <!-- Loading indicator for outline -->
              <div v-if="outlineLoading" class="loading-message">
                <el-icon class="loading-spinner"><Loading /></el-icon>
                <span>Loading outline...</span>
              </div>
              
              <!-- Reusable Outline Component -->
              <ReusableOutlineCt
                v-else
                :outline-data="taskOutline"
                :has-changes="hasOutlineChanges"
                :saving="savingOutline"
                :auto-save="true"
                :auto-save-delay="3000"
                :header-size="'small'"
                :show-history="false"
                :show-breadcrumbs="false"
                save-button-text="Save Outline (⌘S)"
                empty-state-text="No outline items yet. Start typing to create your first outline point..."
                @save="saveTaskOutline"
                @update="onTaskOutlineUpdate"
                @move="handleTaskOutlineMove"
                @delete="handleTaskOutlineDelete"
                @navigate="handleTaskOutlineNavigate"
                @indent="handleTaskOutlineIndent"
                @outdent="handleTaskOutlineOutdent"
                @add-sibling="handleTaskOutlineAddSibling"
              />
            </div>
          </el-tab-pane>

          <!-- E-sign Tab -->
          <el-tab-pane label="E-sign" name="esign">
            <template #label>
              <span class="tab-label">
                <el-icon><Document /></el-icon>
                E-sign
                <el-badge 
                  v-if="esignDocuments.length" 
                  :value="esignDocuments.length" 
                  class="tab-badge"
                />
              </span>
            </template>
            
            <div class="tab-content">
              <!-- Loading indicator for e-sign -->
              <div v-if="esignLoading" class="loading-message">
                <el-icon class="loading-spinner"><Loading /></el-icon>
                <span>Loading documents...</span>
              </div>
              
              <!-- Upload Section -->
              <div v-else class="esign-upload-section">
                <div class="upload-header">
                  <h4>Upload PDF for Signature</h4>
                  <p class="upload-description">
                    Upload a PDF document that external users can sign when accessing the shared task.
                  </p>
                </div>
                
                <el-upload
                  ref="pdfUpload"
                  :file-list="uploadFileList"
                  :auto-upload="false"
                  :on-change="handlePdfFileChange"
                  :on-remove="handlePdfFileRemove"
                  :before-upload="beforePdfUpload"
                  accept=".pdf"
                  :limit="1"
                  class="pdf-upload">
                  <el-button type="primary" :disabled="uploadingPdf">
                    <el-icon><Upload /></el-icon>
                    <span>Select PDF File</span>
                  </el-button>
                  <template #tip>
                    <div class="el-upload__tip">
                      Only PDF files are supported. Max file size: 50MB
                    </div>
                  </template>
                </el-upload>
                
                <div v-if="uploadFileList.length > 0" class="upload-actions">
                  <el-button 
                    type="success" 
                    @click="uploadPdfDocument"
                    :loading="uploadingPdf"
                    :disabled="!uploadFileList.length">
                    <el-icon><Upload /></el-icon>
                    Upload Document
                  </el-button>
                </div>
              </div>

              <!-- Documents List -->
              <div class="esign-documents-section" v-if="esignDocuments.length > 0">
                <div class="documents-header">
                  <h4>Documents for Signature</h4>
                </div>
                
                <div class="documents-list">
                  <div 
                    v-for="document in esignDocuments" 
                    :key="document.id"
                    class="document-item">
                    <div class="document-info">
                      <div class="document-icon">
                        <el-icon><Document /></el-icon>
                      </div>
                      <div class="document-details">
                        <div class="document-name-container">
                          <h5 class="document-name">{{ document.name }}</h5>
                          <p class="document-meta">
                            <span>{{ formatFileSize(document.size) }}</span>
                            <span class="separator">•</span>
                            <span>{{ formatDate(document.created_at) }}</span>
                          </p>
                          <div class="signature-status">
                            <el-tag 
                              :type="getSignatureStatusType(document.signature_status)"
                              size="small">
                              {{ formatSignatureStatus(document.signature_status) }}
                            </el-tag>
                            <span v-if="document.signed_by" class="signed-by">
                              Signed by {{ document.signed_by }}
                            </span>
                          </div>
                        </div>
                        <!-- Enhanced signature display for signed documents -->
                        <div v-if="document.signature_status === 'signed' && document.signatures && document.signatures.length" class="signatures-section">
                          <h5>Digital Signatures</h5>
                          <div v-for="sig in document.signatures" :key="sig.id" class="signature-item">
                            <div class="signature-details">
                              <img
                                :src="sig.signature_image"
                                alt="Digital Signature"
                                class="signature-image" />
                              <div class="signature-info">
                                <div class="signer-name">{{ sig.full_name }}</div>
                                <div class="signer-email">{{ sig.user_email }}</div>
                                <div class="signature-date">
                                  Signed: {{ formatDate(sig.signature_date) }}
                                </div>
                                <div class="signature-location" v-if="sig.ip_address && sig.ip_address !== 'unknown'">
                                  IP: {{ sig.ip_address }}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div class="document-actions">
                      <el-button 
                        type="primary" 
                        @click="viewDocument(document)"
                        size="small">
                        <el-icon><View /></el-icon>
                        View
                      </el-button>
                      <el-button 
                        type="danger" 
                        @click="deleteDocument(document)"
                        size="small"
                        :loading="deletingDocument === document.id">
                        <el-icon><Delete /></el-icon>
                        Delete
                      </el-button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Empty State -->
              <div v-else-if="!esignLoading" class="esign-empty-state">
                <el-empty description="No documents uploaded yet">
                  <el-button type="primary" @click="$refs.pdfUpload.$el.querySelector('input').click()">
                    <el-icon><Upload /></el-icon>
                    Upload First Document
                  </el-button>
                </el-empty>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
    </div>
    
    <!-- Add this new Share Task Dialog after the Edit Task Dialog -->
    <el-dialog
      v-model="shareDialogVisible"
      title="Share Task"
      width="600px"
      class="share-task-dialog">
      
      <el-tabs v-model="activeShareTab" type="border-card">
        
        <!-- Internal Tab -->
        <el-tab-pane label="Internal" name="internal">
          <div class="share-options">
            <div class="share-link-section">
              <h4>Share via Link</h4>
              <div class="link-input">
                <el-input
                  v-model="shareLink"
                  readonly>
                  <template #append>
                    <el-button @click="copyLink">
                      <el-icon><DocumentCopy /></el-icon>
                      Copy
                    </el-button>
                  </template>
                </el-input>
              </div>
            </div>

            <div class="share-email-section">
              <h4>Share via Email</h4>
              <el-form :model="emailShare">
                <el-form-item>
                  <el-select
                    v-model="emailShare.recipients"
                    multiple
                    filterable
                    placeholder="Select recipients"
                    style="width: 100%">
                    <el-option
                      v-for="user in sortedSharedUsers"
                      :key="user.id"
                      :label="user.email"
                      :value="user.email" />
                  </el-select>
                </el-form-item>
                <el-form-item>
                  <el-input
                    v-model="emailShare.message"
                    type="textarea"
                    :rows="3"
                    placeholder="Add a message (optional)" />
                </el-form-item>
              </el-form>
              <el-button
                type="primary"
                :disabled="!emailShare.recipients.length"
                :loading="sending"
                @click="shareViaEmail">
                Send Email
              </el-button>
            </div>
          </div>
        </el-tab-pane>

        <!-- External Tab -->
        <el-tab-pane label="External" name="external">
          <div class="external-share-options">
            <div class="external-share-info">
              <el-alert
                type="info"
                :closable="false"
                show-icon>
                <template #title>
                  External Sharing
                </template>
                External users will need to login to access the shared task. They will only have access to this specific task.
              </el-alert>
            </div>

            <!-- Generate button when no history exists -->
            <div v-if="!externalShareHistory.length" class="external-link-section">
              <div class="external-link-controls">
                <el-button 
                  type="primary"
                  :loading="generatingExternalLink"
                  @click="handleGenerateExternalShareLink"
                  :disabled="hasActiveShare">
                  <el-icon><Link /></el-icon>
                  Generate Shareable Link
                </el-button>
              </div>
            </div>

            <!-- Share history with generate button -->
            <div v-if="externalShareHistory.length" class="external-share-history">
              <div class="share-history-header">
                <h4>Share History</h4>
                <el-button 
                  type="primary"
                  size="small"
                  :loading="generatingExternalLink"
                  @click="handleGenerateExternalShareLink"
                  v-if="!hasActiveShare">
                  <el-icon><Link /></el-icon>
                  Generate Shareable Link
                </el-button>
              </div>
              <el-table 
                :data="externalShareHistory" 
                size="small"
                style="width: 100%">
                <el-table-column
                  prop="created_at"
                  label="Created">
                  <template #default="scope">
                    {{ formatDate(scope.row.created_at) }}
                  </template>
                </el-table-column>
                <el-table-column
                  prop="status"
                  label="Status">
                  <template #default="scope">
                    <el-tag 
                      :type="scope.row.status === 'active' ? 'success' : 'danger'"
                      size="small">
                      {{ scope.row.status }}
                    </el-tag>
                  </template>
                </el-table-column>
                <!--el-table-column
                  prop="access_count"
                  label="Access Count"
                  width="100">
                </el-table-column-->
                <el-table-column
                  label="Actions">
                  <template #default="scope">
                    <div class="action-buttons">
                      <el-button 
                        v-if="scope.row.status === 'active'"
                        type="success"
                        size="small"
                        @click="handleCopySpecificExternalLink(scope.row.short_id)">
                        Copy Link
                      </el-button>
                      <el-button 
                        v-if="scope.row.status === 'active'"
                        type="danger"
                        size="small"
                        @click="handleRevokeSpecificExternalLink(scope.row.id)">
                        Revoke
                      </el-button>
                    </div>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </div>
        </el-tab-pane>
        
      </el-tabs>
    </el-dialog>

    <!-- File Selector Dialog -->
    <el-dialog
      v-model="showFileSelector"
      title="Select File"
      width="500px">
      <div class="file-selector-header">
        <el-breadcrumb separator="/">
          <el-breadcrumb-item 
            @click="navigateSelectorFolder(null)"
            :class="{ clickable: currentSelectorFolder }">
            Root
          </el-breadcrumb-item>
          <el-breadcrumb-item 
            v-for="folder in selectorBreadcrumbs" 
            :key="folder.id"
            @click="navigateSelectorFolder(folder)"
            :class="{ clickable: folder.id !== currentSelectorFolder?.id }">
            {{ folder.name }}
          </el-breadcrumb-item>
        </el-breadcrumb>
      </div>

      <el-input
        v-model="fileSearchQuery"
        placeholder="Search files..."
        clearable
        style="margin-bottom: 1rem;" />
      
      <el-scrollbar height="300px">
        <div class="file-list">
          <div
            v-for="item in filteredFiles"
            :key="item.id"
            class="file-item"
            @click="item.type === 'dir' ? navigateSelectorFolder(item) : selectFile(item)">
            <el-icon v-if="item.type === 'dir'" class="folder-icon">
              <Folder />
            </el-icon>
            {{ item.name }}
          </div>
        </div>
      </el-scrollbar>
    </el-dialog>

    <!-- Log Hours Dialog -->
    <el-dialog
      v-model="logHoursDialogVisible"
      title="Log Hours"
      width="500px"
      class="log-hours-dialog"
    >
      <el-form :model="newHoursLog" label-position="top">
        <el-form-item label="Time" required>
          <div class="time-input-container">
            <div class="time-input-group-container">
              <div class="time-input-group">
                <el-input
                  ref="hoursInput"
                  v-model="hours"
                  placeholder="HH"
                  @input="validateHours"
                  @blur="formatHours"
                  @keyup="handleHoursKeyup"
                  size="small"
                  style="width: 50px"
                  maxlength="2"
                />
                <span class="time-separator">:</span>
                <el-input
                  ref="minutesInput"
                  v-model="minutes"
                  placeholder="MM"
                  @input="validateMinutes"
                  @blur="formatMinutes"
                  @keydown="handleMinutesKeydown"
                  size="small"
                  style="width: 50px"
                  maxlength="2"
                />
              </div>
              <span class="time-unit">hours</span>
            </div>
            <small class="time-input-help" :class="{ 'error-text': timeError }">
              {{ timeError || 'Hours (0-12), Minutes (0-59)' }}
            </small>
          </div>
        </el-form-item>
        <el-form-item label="Comment">
          <el-input
            v-model="newHoursLog.comment"
            type="textarea"
            :rows="3"
            placeholder="Add a comment about the work done..."
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="logHoursDialogVisible = false">Cancel</el-button>
          <el-button
            type="primary"
            @click="submitHoursLog"
            :disabled="!newHoursLog.time_taken">
            Submit
          </el-button>
        </span>
      </template>
    </el-dialog>

    <!-- Create Child Task Dialog -->
    <el-dialog
      v-model="createChildTaskDialogVisible"
      title="Create Child Task"
      width="600px"
      class="create-child-task-dialog"
    >
      <el-form :model="newChildTask" label-position="top" ref="childTaskForm">
        <el-form-item label="Title" required>
          <el-input
            v-model="newChildTask.title"
            placeholder="Enter child task title..."
            maxlength="255"
            show-word-limit
          />
        </el-form-item>
        
        <el-form-item label="Description">
          <TiptapEditor
            v-model="newChildTask.description"
            placeholder="Add a description..."
            :sharedUsers="sharedUsers"
            :taskId="String(task.id)"
            :taskTitle="task.title"
            :isTaskComment="false"
            :enable-typeahead="false"
          />
        </el-form-item>

        <div class="child-task-metadata">
          <div class="metadata-row">
            <el-form-item label="Status" class="metadata-field">
              <el-select v-model="newChildTask.status" placeholder="Select status">
                <el-option
                  v-for="option in statusOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>
            </el-form-item>

            <el-form-item label="Priority" class="metadata-field">
              <el-select v-model="newChildTask.priority" placeholder="Select priority">
                <el-option
                  v-for="option in priorityOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>
            </el-form-item>
          </div>

          <div class="metadata-row">
            <el-form-item label="Due Date" class="metadata-field">
              <el-date-picker
                v-model="newChildTask.due_date"
                type="date"
                placeholder="Select due date"
                style="width: 100%"
              />
            </el-form-item>

            <el-form-item label="Assigned To" class="metadata-field">
              <el-select
                v-model="newChildTask.assignee"
                placeholder="Select assignee"
                clearable 
                filterable
              >
                <el-option
                  v-for="user in sortedSharedUsers"
                  :key="user.id"
                  :label="user.email"
                  :value="user.id"
                />
              </el-select>
            </el-form-item>
          </div>
        </div>
      </el-form>

      <template #footer>
        <span class="dialog-footer">
          <el-button @click="createChildTaskDialogVisible = false">Cancel</el-button>
          <el-button
            type="primary"
            @click="createChildTask"
            :disabled="!newChildTask.title.trim()"
            :loading="creatingChildTask">
            Create Child Task
          </el-button>
        </span>
      </template>
    </el-dialog>

    <PdfSignatureModal
      v-model="showSignaturePositionModal"
      :document="pendingPdfFile ? { name: pendingPdfFileName, download_url: pendingPdfFile } : null"
      :positionOnlyMode="true"
      @positions-set="handleSignaturePositionsSet"
    />

    <!-- Create Task Dialog -->
    <el-dialog
      v-model="createTaskDialogVisible"
      title="Create New Task" 
      class="create-task-dialog"
      width="500px">
      <el-form :model="newTask" label-position="top">
        <!-- Essential fields always shown -->
        <el-form-item label="Title" required>
          <el-input v-model="newTask.title" />
        </el-form-item>
        <el-form-item label="Description">
          <TiptapEditor
            v-model="newTask.description"
            placeholder="Write a description..."
            :task-title="newTask.title || 'New Task'"
            :shared-users="sharedUsers"
            :enable-typeahead="false"
          />
        </el-form-item>

        <!-- Show more/less button -->
        <div class="show-more-container">
          <el-button 
            link 
            type="primary" 
            @click="showMoreFields = !showMoreFields">
            {{ showMoreFields ? 'Show Less' : 'Show More Options' }}
            <el-icon class="el-icon--right">
              <component :is="showMoreFields ? 'ArrowUp' : 'ArrowDown'" />
            </el-icon>
          </el-button>
        </div>

        <!-- Additional fields in collapse transition -->
        <el-collapse-transition>
          <div v-show="showMoreFields">
            <el-form-item label="Parent Task">
              <el-select 
                v-model="newTask.parent_task_id" 
                style="width: 100%" 
                filterable 
                clearable
                placeholder="Select parent task (optional)">
                <el-option
                  v-for="task in flattenedTasks"
                  :key="task.id"
                  :label="task.title"
                  :value="task.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="Priority">
              <el-select v-model="newTask.priority" style="width: 100%">
                <el-option label="High" value="high" />
                <el-option label="Medium" value="medium" />
                <el-option label="Low" value="low" />
              </el-select>
            </el-form-item>
            <el-form-item label="Due Date">
              <el-date-picker
                v-model="newTask.due_date"
                type="date"
                style="width: 100%" />
            </el-form-item>
            <el-form-item label="Assignee">
              <el-select 
                v-model="newTask.assignee" 
                style="width: 100%"
                filterable
                clearable
                placeholder="Select assignee">
                <el-option
                  v-for="user in sortedSharedUsers"
                  :key="user.id"
                  :label="user.email"
                  :value="user.id" />
              </el-select>
            </el-form-item>
          </div>
        </el-collapse-transition>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="createTaskDialogVisible = false">Cancel</el-button>
          <el-button
            type="primary"
            @click="createNewTask"
            :disabled="!newTask.title">
            Create
          </el-button>
        </span>
      </template>
    </el-dialog>

    <!-- Move to Workspace Dialog -->
    <el-dialog
      v-model="moveToDialogVisible"
      title="Move to Workspace" 
      class="move-to-dialog"
      width="500px">
      <div class="move-to-content">
        <p class="move-to-description">
          Select a workspace to move this task to. The task and all its associated data (comments, hours logs) will be moved to the selected workspace.
        </p>
        
        <el-form :model="moveToForm" label-position="top">
          <el-form-item label="Select Workspace" required>
            <el-select 
              v-model="moveToForm.targetWorkspaceId" 
              style="width: 100%"
              filterable
              clearable
              placeholder="Choose a workspace to move the task to">
              <el-option
                v-for="workspace in availableWorkspaces"
                :key="workspace.id"
                :label="workspace.title"
                :value="workspace.id" />
            </el-select>
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="moveToDialogVisible = false">Cancel</el-button>
          <el-button
            type="primary"
            @click="moveTaskToWorkspace"
            :disabled="!moveToForm.targetWorkspaceId"
            :loading="movingTask">
            Move Task
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
  <div v-else class="loading-state">
    <el-skeleton :rows="3" animated />
  </div>
</template>

<script>
import { ArrowLeft, DocumentCopy, Folder, Close, Document, Star, StarFilled, ArrowDown, ArrowUp, Clock, Timer, User, Calendar, Edit, CircleCheck, Warning, Delete, More, Setting, Share, Download, View, CopyDocument, Link, Plus, Loading, DocumentChecked, ChatDotRound, List, InfoFilled, Upload, Position } from '@element-plus/icons-vue';
import VerticalDotsIcon from '../icons/VerticalDotsIcon.vue';
import { supabase } from '../../supabase';
import { useWorkspaceStore } from '../../store/workspace';
import { useTaskStore } from '../../store/task';
import { useUserStore } from '../../store/user';
import { storeToRefs } from 'pinia';
import { ElNotification, ElMessageBox, ElMessage } from 'element-plus';
import TiptapEditor from '../common/TiptapEditor.vue';
import { sendTelegramNotification } from '../common/telegramNotification';
import { emailNotification } from '../../utils/notificationHelpers';
import { updateMatterActivity } from '../../utils/workspaceActivity';
import ReusableOutlineCt from './ReusableOutlineCt.vue';
import { useExternalTaskShare } from '../../composables/useExternalTaskShare';
import PdfSignatureModal from '../common/PdfSignatureModal.vue';
import { setTaskTitle } from '../../utils/page-title';

export default {
  components: {
    ArrowLeft,
    DocumentCopy,
    Folder,
    Close,
    Document,
    TiptapEditor,
    ArrowDown,
    ArrowUp,
    Star,
    StarFilled,
    Clock,
    Timer,
    User,
    Calendar,
    Edit,
    CircleCheck,
    Warning,
    Delete,
    More,
    VerticalDotsIcon,
    Setting,
    Share,
    Download,
    View,
    CopyDocument,
    Link,
    Plus,
    Loading,
    DocumentChecked,
    ChatDotRound,
    List,
    ReusableOutlineCt,
    InfoFilled,
    Upload,
    Position,
    PdfSignatureModal,
  },
  setup() {
    const workspaceStore = useWorkspaceStore();
    const taskStore = useTaskStore();
    const userStore = useUserStore();
    const { currentWorkspace } = storeToRefs(workspaceStore);
    
    // External sharing composable
    const externalShareComposable = useExternalTaskShare();
    
    return { 
      currentWorkspace, 
      taskStore,
      userStore,
      ...externalShareComposable
    };
  },
  data() {
    return {
      task: null,
      loading: false,
      commentsLoading: false,
      addingComment: false,
      updatingAssignee: false,
      savingComment: false,
      comments: [],
      newComment: '',
      userEmails: {},
      editDialogVisible: false,
      editingTask: null,
      sharedUsers: [],
      assigneeEmail: null,
      subscription: null,
      shareDialogVisible: false,
      shareLink: '',
      emailShare: {
        recipients: [],
        message: ''
      },
      sending: false,
      files: [],
      showFileSelector: false,
      mentionIndex: -1,
      fileSearchQuery: '',
      editingCommentId: null,
      editingCommentText: '',
      currentUser: null,
      expandedCommentHistories: new Set(),
      showEditHistory: false,
      showTaskHistory: false,
      currentSelectorFolder: null,
      selectorBreadcrumbs: [],
      folders: [],
      showTypeahead: false,
      typeaheadSuggestions: [],
      typeaheadSelectedIndex: -1,
      typeaheadTimer: null,
      pythonApiBaseUrl: import.meta.env.VITE_PYTHON_API_URL  || 'http://localhost:3001',
      logHoursDialogVisible: false,
      newHoursLog: {
        time_taken: null,
        comment: ''
      },
      hours: '',
      minutes: '',
      timeError: '',
      hoursLogs: [],
      showAllLogs: false,
      //displayedHoursLogs: [],
      showAllLogs: false,
      tempDueDate: null,
      isEditingTitle: false,
      editingTitle: '',
      savingTitle: false,
      isEditingDescription: false,
      editingDescription: '',
      savingDescription: false,
      showArchivedComments: false,
      showSystemComments: false,
      isEditingStatus: false,
      statusText: '',
      isEditingPriority: false,
      isEditingAssignee: false,
      updatingStatus: false,
      updatingPriority: false,
      dueDatePopoverVisible: false,
      statusOptions: [
        { value: 'not_started', label: 'Not started' },
        { value: 'in_progress', label: 'In Progress' },
        { value: 'not_needed_anymore', label: 'Not needed anymore' },
        { value: 'awaiting_external', label: 'Awaiting external factor' },
        { value: 'awaiting_internal', label: 'Awaiting internal factor' },
        { value: 'completed', label: 'Completed' }
      ],
      priorityOptions: [
        { value: 'low', label: 'Low' },
        { value: 'medium', label: 'Medium' },
        { value: 'high', label: 'High' }
      ],
      USERS_TO_BYPASS_AI_INTERACTION: [
          'soumen+040225@grmtech.com'
      ],

      createChildTaskDialogVisible: false,
      creatingChildTask: false,
      newChildTask: {
        title: '',
        description: '',
        status: 'not_started',
        priority: 'medium',
        due_date: null,
        assignee: null
      },
      childTaskPopoverVisibility: {
        status: {},
        priority: {}
      },
      updatingChildTasks: new Set(),
      sortColumn: 'priority',
      sortDirection: 'desc', // 'asc' or 'desc'
      showCompletedTasks: true,
      
      // Task outline properties
      taskOutline: [],
      outlineLoading: false,
      savingOutline: false,
      hasOutlineChanges: false,
      lastSavedOutlineContent: null,
      
      // Tab management
      activeTab: 'comments',
      activeShareTab: 'internal',
      
      // External sharing
      testingApi: false,
      esignDocuments: [],
      esignLoading: false,
      uploadingPdf: false,
      uploadFileList: [],
      deletingDocument: null,
      showParentSelector: false,
      showSignaturePositionModal: false,
      pendingPdfFile: null,
      pendingPdfFileName: '',
      pendingPdfFileObj: null,
      pendingSignaturePositions: [],
      
      // Create task dialog properties
      createTaskDialogVisible: false,
      newTask: {
        title: '',
        description: '',
        status: 'not_started',
        priority: 'medium',
        due_date: null,
        assignee: null,
        parent_task_id: null
      },
      showMoreFields: false,
      
      // Move to workspace dialog properties
      moveToDialogVisible: false,
      moveToForm: {
        targetWorkspaceId: null
      },
      availableWorkspaces: [],
      movingTask: false,
    };
  },
  async created() {
    const taskId = this.$route.params.taskId;
    const { data: { user } } = await supabase.auth.getUser();
    this.currentUser = user;
    this.loadUserSettings();
    
    // Load task first (this will handle caching)
    await this.loadTask(taskId);
    
            // Load other data in parallel
        await Promise.all([
          this.loadSharedUsers(),
          this.refreshTaskCache(),
          this.loadTaskOutline(),
          this.loadEsignDocuments()
        ]);
    
    this.setupRealtimeSubscription();
  },

  async activated() {
    // Refresh cache when component becomes active (e.g., when navigating back from child task)
    await this.refreshTaskCache();
  },
  unmounted() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    document.title = 'TaskManager';
  },
  methods: {
    updatePageTitle() {
      const workspaceName = this.currentWorkspace?.title || 'Workspace';
      const taskTitle = this.task?.title;
      setTaskTitle(taskTitle, workspaceName, 'Tasks');
    },

    async handleDueDateChange(date) {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ 
          due_date: date ? date.toISOString() : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', this.task.id);

      if (error) throw error;
      this.tempDueDate = date;
      this.task.due_date = date;
      
      // Update cache
      this.taskStore.updateCachedTaskDetail(this.task.id, { task: this.task });
      
      // Update workspace activity
      await updateMatterActivity(this.currentWorkspace.id);
      
      ElNotification.success({
        title: 'Success',
        message: 'Due date updated successfully'
      });
    } catch (error) {
      console.error('Error updating due date:', error);
      ElNotification.error({
        title: 'Error',
        message: 'Failed to update due date'
      });
      this.tempDueDate = this.task?.due_date ? new Date(this.task.due_date) : null;
    }
  },

  async clearDueDate() {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ 
          due_date: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', this.task.id);

      if (error) throw error;
      this.task.due_date = null;
      this.tempDueDate = null;
      
      // Update cache
      this.taskStore.updateCachedTaskDetail(this.task.id, { task: this.task });
      
      // Update workspace activity
      await updateMatterActivity(this.currentWorkspace.id);
      
      ElNotification.success({
        title: 'Success',
        message: 'Due date cleared successfully'
      });
    } catch (error) {
      console.error('Error clearing due date:', error);
      ElNotification.error({
        title: 'Error',
        message: 'Failed to clear due date'
      });
    }
  },
    startDescriptionEdit() {
    this.editingDescription = this.task?.description || '';
    this.isEditingDescription = true;
  },

  async saveDescriptionEdit() {
    if (!this.editingDescription.trim() || this.editingDescription === this.task?.description) {
      this.cancelDescriptionEdit();
      return;
    }

    try {
      this.savingDescription = true;
      const { error } = await supabase
        .from('tasks')
        .update({ 
          description: this.editingDescription,
          updated_at: new Date().toISOString()
        })
        .eq('id', this.task.id);

      if (error) throw error;
      console.log(this.editingDescription);

      // Add Telegram notification here
      await sendTelegramNotification({
        workspaceId: this.currentWorkspace.id,
        activityType: 'TASK_DESCRIPTION_UPDATED',
        message: `Task description updated for "${this.task.title}"\n\nFrom: "${this.task.description || 'No description'}"\nTo: "${this.editingDescription}"`
      });

      this.task.description = this.editingDescription;
      
      // Update cache
      this.taskStore.updateCachedTaskDetail(this.task.id, { task: this.task });
      
      // Update workspace activity
      await updateMatterActivity(this.currentWorkspace.id);
      
      ElNotification.success({
        title: 'Success',
        message: 'Task description updated successfully'
      });
      this.isEditingDescription = false;
    } catch (error) {
      console.error('Error updating task description:', error);
      ElNotification.error({
        title: 'Error',
        message: 'Failed to update task description'
      });
    } finally {
      this.savingDescription = false;
    }
  },

  cancelDescriptionEdit() {
    this.isEditingDescription = false;
    this.editingDescription = '';
  },
    startTitleEdit() {
    this.editingTitle = this.task?.title || '';
    this.isEditingTitle = true;
    this.$nextTick(() => {
      this.$refs.titleInput?.focus();
    });
  },

  async saveTitleEdit() {
    if (!this.editingTitle.trim() || this.editingTitle === this.task?.title) {
      this.cancelTitleEdit();
      return;
    }

    try {
      this.savingTitle = true;
      const { error } = await supabase
        .from('tasks')
        .update({ 
          title: this.editingTitle,
          updated_at: new Date().toISOString()
        })
        .eq('id', this.task.id);

      if (error) throw error;

      // Add Telegram notification here
      await sendTelegramNotification({
        workspaceId: this.currentWorkspace.id,
        activityType: 'TASK_TITLE_UPDATED',
        message: `Task title updated\nFrom: "${this.task.title}"\nTo: "${this.editingTitle}"`
      });

      this.task.title = this.editingTitle;
      
      // Update cache
      this.taskStore.updateCachedTaskDetail(this.task.id, { task: this.task });
      
      // Update workspace activity
      await updateMatterActivity(this.currentWorkspace.id);
      
      ElNotification.success({
        title: 'Success',
        message: 'Task title updated successfully'
      });
      this.isEditingTitle = false;
    } catch (error) {
      console.error('Error updating task title:', error);
      ElNotification.error({
        title: 'Error',
        message: 'Failed to update task title'
      });
    } finally {
      this.savingTitle = false;
    }
  },

  cancelTitleEdit() {
    this.isEditingTitle = false;
    this.editingTitle = '';
  },
    async updateDueDate() {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ due_date: this.tempDueDate })
        .eq('id', this.task.id);

      if (error) throw error;

      ElNotification.success({
        title: 'Success',
        message: 'Due date updated successfully'
      });
      this.closeDueDatePopover();
    } catch (error) {
      console.error('Error updating due date:', error);
      ElNotification.error({
        title: 'Error',
        message: 'Failed to update due date'
      });
    }
  },


  closeDueDatePopover() {
    // Reset temp date and close popover
    this.tempDueDate = this.task?.due_date || null;
    const popover = document.querySelector('.due-date-popover');
    if (popover) {
      popover._instance.hide();
    }
  },
    async handleAssigneeChange(userId) {
    try {
      this.updatingAssignee = true;
      const { error } = await supabase
        .from('tasks')
        .update({ assignee: userId || null })
        .eq('id', this.task.id);

      if (error) throw error;

      this.task.assignee = userId;
      this.assigneeEmail = this.sharedUsers.find(u => u.id === userId)?.email;
      
      // Update cache
      this.taskStore.updateCachedTaskDetail(this.task.id, { task: this.task });
      
      // Update workspace activity
      await updateMatterActivity(this.currentWorkspace.id);
      
      ElNotification.success({
        title: 'Success',
        message: 'Assignee updated successfully'
      });
      
      // Call emailNotification with the required parameters
      emailNotification(
        'task_assigned',
        this.task.id
        // this.assigneeEmail
      );
    } catch (error) {
      ElNotification.error({
        title: 'Error',
        message: 'Error updating assignee: ' + error.message
      });
    } finally {
      this.updatingAssignee = false;
    }
  },
    toggleShowMore() {
    this.showAllLogs = !this.showAllLogs;
  },
    formatTime(time) {
      if (!time) return '0:00';
      const [hours, minutes] = time.split(':');
      return `${parseInt(hours)}h ${minutes}m`;
    },

    formatEmail(email) {
      if (!email) return 'Unknown';
      const [name] = email.split('@');
      return name.length > 15 ? name.substring(0, 12) + '...' : name;
    },

    formatDate(dateString) {
      return new Date(dateString).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    },

    formatTimeOnly(dateString) {
      return new Date(dateString).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit'
      });
    },

    formatDateTime(dateString) {
      return new Date(dateString).toLocaleString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    },

    formatFileSize(bytes) {
      // Handle null, undefined, or non-numeric values
      if (!bytes || typeof bytes !== 'number' || isNaN(bytes)) {
        return '0 Bytes';
      }
      
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    getInitials(email) {
      if (!email) return '--';
      const [name] = email.split('@');
      return name.substring(0, 2).toUpperCase();
    },
    async handleStatusChange(status) {
      try {
        this.updatingStatus = true;
        const { data: { user } } = await supabase.auth.getUser();
        
        const oldStatus = this.task.status;
        
        const { error } = await supabase
          .from('tasks')
          .update({ 
            status: status,
            updated_at: new Date().toISOString()
          })
          .eq('id', this.task.id);

        if (error) throw error;

        // Update local state immediately
        this.task.status = status;
        
        // Update cache
        this.taskStore.updateCachedTaskDetail(this.task.id, { task: this.task });
        
        // Create activity log
        await supabase
          .from('task_comments')
          .insert({
            task_id: this.task.id,
            user_id: user.id,
            content: `Updated status from "${this.formatStatus(oldStatus)}" to "${this.formatStatus(status)}"`,
            type: 'activity',
            matter_id: this.task.matter_id,
            metadata: {
              action: 'update',
              changes: {
                status: {
                  from: oldStatus,
                  to: status
                }
              }
            }
          });

        // Update workspace activity
        await updateMatterActivity(this.currentWorkspace.id);

        ElNotification.success({
          title: 'Success',
          message: 'Task status updated successfully'
        });
        
        // Close the popover using the ref
        if (this.$refs.statusPopover) {
          this.$refs.statusPopover.hide();
        }
      } catch (error) {
        console.error('Error updating task status:', error);
        ElNotification.error({
          title: 'Error',
          message: 'Failed to update task status'
        });
      } finally {
        this.updatingStatus = false;
      }
    },
    async handlePriorityChange(priority) {
      try {
        this.updatingPriority = true;
        const { error } = await supabase
          .from('tasks')
          .update({ priority })
          .eq('id', this.task.id);

        if (error) throw error;

        // Update local task priority
        this.task.priority = priority;
        
        // Update cache
        this.taskStore.updateCachedTaskDetail(this.task.id, { task: this.task });
        
        // Update workspace activity
        await updateMatterActivity(this.currentWorkspace.id);
        
        ElNotification.success({
          title: 'Success',
          message: 'Task priority updated successfully'
        });
        
        // Close the popover using the ref
        if (this.$refs.priorityPopover) {
          this.$refs.priorityPopover.hide();
        }

      } catch (error) {
        ElNotification.error({
          title: 'Error',
          message: 'Error updating task priority: ' + error.message
        });
      } finally {
        this.updatingPriority = false;
      }
    },
    async toggleTaskStar() {
    try {
      const isStarred = this.isTaskStarred;

      if (isStarred) {
        // Remove star
        const { error } = await supabase
          .from('task_stars')
          .delete()
          .eq('task_id', this.task.id)
          .eq('user_id', this.currentUser.id);

        if (error) throw error;
        this.task.task_stars = this.task.task_stars.filter(star => star.user_id !== this.currentUser.id);
      } else {
        // Add star
        const { data, error } = await supabase
          .from('task_stars')
          .insert({
            task_id: this.task.id,
            user_id: this.currentUser.id,
            matter_id: this.task.matter_id
          })
          .select();

        if (error) throw error;
        this.task.task_stars = [...(this.task.task_stars || []), data[0]];
      }

      // Update workspace activity
      await updateMatterActivity(this.currentWorkspace.id);

      ElNotification.success({
        title: 'Success',
        message: `Task ${isStarred ? 'unstarred' : 'starred'} successfully`
      });
    } catch (error) {
      ElNotification.error({
        title: 'Error',
        message: 'Error toggling star: ' + error.message
      });
    }
  },
    async loadTask(taskId, showMainLoading = true) {
      try {
        // First try to load from cache
        const cachedTaskDetail = this.taskStore.getCachedTaskDetail(taskId);
        if (cachedTaskDetail) {
          console.log('Loading task detail from cache');
          this.task = cachedTaskDetail.task;
          this.editingTask = { ...cachedTaskDetail.task };
          this.comments = cachedTaskDetail.comments || [];
          this.hoursLogs = cachedTaskDetail.hoursLogs || [];
          
          // Load user emails for comments and hours logs
          await this.loadUserEmailsFromCache();
          
          if (this.task.assignee) {
            const { data: userData } = await supabase
              .rpc('get_user_info_by_id', { user_id: this.task.assignee });
            this.assigneeEmail = userData?.[0]?.email;
          }
          
          // Don't show loading state since we have cached data
          this.loading = false;
        } else {
          // Only show loading if no cached data is available
          if (showMainLoading) {
            this.loading = true;
          }
        }

        // Fetch fresh data in background
        console.log('Fetching fresh task detail from API');
        const freshTaskDetail = await this.taskStore.fetchAndCacheTaskDetail(taskId);
        
        // Update with fresh data
        this.task = freshTaskDetail.task;
        this.editingTask = { ...freshTaskDetail.task };
        this.comments = freshTaskDetail.comments || [];
        this.hoursLogs = freshTaskDetail.hoursLogs || [];
        
        // Load user emails for any new data
        await this.loadUserEmailsFromCache();
        
        if (this.task.assignee) {
          const { data: userData } = await supabase
            .rpc('get_user_info_by_id', { user_id: this.task.assignee });
          this.assigneeEmail = userData?.[0]?.email;
        }

      } catch (error) {
        ElNotification.error({
          title: 'Error',
          message: 'Error loading task: ' + error.message
        });
      } finally {
        // Always set loading to false when done
        this.loading = false;
      }
    },
    async loadUserEmailsFromCache() {
      try {
        // Collect all unique user IDs that need email lookup
        const userIds = new Set();
        
        // Add user IDs from comments
        this.comments.forEach(comment => {
          if (comment.user_id && !this.userEmails[comment.user_id]) {
            userIds.add(comment.user_id);
          }
        });

        // Add user IDs from hours logs
        this.hoursLogs.forEach(log => {
          if (log.user_id && !this.userEmails[log.user_id]) {
            userIds.add(log.user_id);
          }
        });

        // Load all user emails in parallel
        const emailPromises = Array.from(userIds).map(async (userId) => {
          try {
            const { data: userData } = await supabase
              .rpc('get_user_info_by_id', { user_id: userId });
            if (userData?.[0]) {
              this.userEmails[userId] = userData[0].email;
            }
          } catch (error) {
            console.error(`Error loading email for user ${userId}:`, error);
          }
        });

        await Promise.all(emailPromises);
      } catch (error) {
        console.error('Error loading user emails:', error);
      }
    },

    async loadComments() {
      try {
        this.commentsLoading = true;
        const { data: comments, error } = await supabase
          .from('task_comments')
          .select('*')
          .eq('task_id', this.task.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Load user emails for each comment
        for (const comment of comments) {
          if (!this.userEmails[comment.user_id]) {
            const { data: userData } = await supabase
              .rpc('get_user_info_by_id', {
                user_id: comment.user_id
              });
            if (userData?.[0]) {
              this.userEmails[comment.user_id] = userData[0].email;
            }
          }
        }

        // Update comments and cache
        this.comments = comments;
        this.taskStore.updateCachedTaskDetail(this.task.id, { comments });
      } catch (error) {
        ElNotification.error({
          title: 'Error',
          message: 'Error loading comments: ' + error.message
        });
      } finally {
        this.commentsLoading = false;
      }
    },
    async addComment() {
      if (!this.newComment.trim()) return;

      try {
        this.addingComment = true;
        const { data: { user } } = await supabase.auth.getUser();

        // First post the user's comment
        const { data, error } = await supabase
          .from('task_comments')
          .insert({
            task_id: this.task.id,
            user_id: user.id,
            content: this.newComment.trim(),
            matter_id: this.task.matter_id
          })
          .select();

        if (error) throw error;
        //console.log('this.newComment.trim()', this.newComment.trim());
        // Send Telegram notification
        await sendTelegramNotification({
          workspaceId: this.currentWorkspace.id,
          activityType: 'NEW_COMMENT',
          message: `New comment on task "${this.task.title}"\n\nComment: ${this.newComment.trim()}\nBy: ${user.email}`
        });

        // Handle AI Attorney mentions
        const aiMentionRegex = /<span data-mention[^>]*data-id="([^"]+)"[^>]*>@([^<]+)<\/span>/g;
        const mentions = [...this.newComment.matchAll(aiMentionRegex)];

        for (const mention of mentions) {
          const mentionId = mention[1];
          const mentionName = mention[2];
          
          if (mentionId === 'aiAttorney') {
            // Handle default AI Attorney
            const prompt = this.newComment.replace(mention[0], '').trim();
            const aiResponse = await this.getAIResponse(prompt);

            await this.postAIResponse(aiResponse);
          } else if (!mentionId.includes('-')) { // Check if it's a UUID (user) or number (AI attorney)
            // Handle specific AI Attorney
            try {
              const { data: attorney } = await supabase
                .from('attorneys')
                .select('system_prompt')
                .eq('id', mentionId)
                .single();

              if (attorney) {
                const prompt = this.newComment.replace(mention[0], '').trim();
                const aiResponse = await this.getAIResponse(prompt, attorney.system_prompt);
                console.log('mentionName:', mentionName);
                await this.postAIResponse(aiResponse, mentionName);
              }
            } catch (error) {
              console.error('Error getting attorney:', error);
            }
          } else {
            // Handle user mentions (existing functionality)
            await this.createNotification(mentionId, 'mention', {
              task_id: this.task.id,
              task_title: this.task.title,
              comment_by: user.email
            });
          }
        }

        // Update workspace activity
        await updateMatterActivity(this.currentWorkspace.id);

        this.newComment = '';
        await this.loadComments();
        ElNotification.success({
          title: 'Success',
          message: 'Comment added successfully'
        });
      } catch (error) {
        ElNotification.error({
          title: 'Error',
          message: 'Error adding comment: ' + error.message
        });
      } finally {
        this.addingComment = false;
      }
    },
    async getAIResponse(prompt, customSystemPrompt = null) {
      try {

        const { data: { user } } = await supabase.auth.getUser();

        // If user email is in bypass list, return dummy response
        if (this.USERS_TO_BYPASS_AI_INTERACTION.includes(user.email)) {
          return {
            template_content: "This is a dummy AI response for testing purposes. The original prompt was: " + prompt
          };
        }

        // Extract hyperlinks to image files using regex
        const imageLinkRegex = /\[([^\]]+\.(jpg|jpeg|png|gif|webp|pdf|txt))\]\(([^)]+\.(jpg|jpeg|png|gif|webp|pdf|txt))\)/gi;
        const imageLinks = [...prompt.matchAll(imageLinkRegex)];
        
        // Clean the prompt by removing markdown image links
        const cleanPrompt = prompt.replace(imageLinkRegex, '').trim();

        // Get the first image URL if available
        let imageUrl = null;
        if (imageLinks.length > 0) {
          imageUrl = imageLinks[0][3]; // Get URL from first match
        }

        const commentsHistory = this.comments.map(comment => {
          const timestamp = comment.updated_at || comment.created_at;
          const formattedDate = new Date(timestamp).toLocaleString();
          return `[${formattedDate}] ${this.getCommentAuthor(comment)}: ${comment.content}`;
        }).join('\n\n');

        const taskContext = `Task Title: "${this.task.title}"
        ${this.task.description ? `\nTask Description: ${this.task.description}` : ''}`;

        const systemPrompt = customSystemPrompt || `You are an AI legal assistant helping with the following task:`;

        const response = await fetch(`${this.pythonApiBaseUrl}/gpt/get_ai_response_v2`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: imageUrl? {
              text: cleanPrompt,
              image_url: imageUrl
            } : cleanPrompt,
            systemPrompt: systemPrompt + `\n\n${taskContext}` + `\n\nComment History:\n${commentsHistory}`,
            taskId: this.task.id,
            workspaceId: this.task.matter_id
          })
        });

        if (!response.ok) throw new Error('Failed to get AI response');

        const data = await response.json();
        return data;
      } catch (error) {
        console.error('Error getting AI response:', error);
        return 'Sorry, I encountered an error while processing your request.';
      }
    },
    async postAIResponse(response, attorneyName = null) {
      console.log('attorneyName:', attorneyName);
      try {
        const { error } = await supabase
          .from('task_comments')
          .insert({
            task_id: this.task.id,
            user_id: null,
            content: response.template_content,
            type: 'ai_response',
            matter_id: this.task.matter_id,
            metadata: {
              is_ai: true,
              ai_name: attorneyName || 'AI Attorney'
            }
          });

        if (error) throw error;
      } catch (error) {
        console.error('Error posting AI response:', error);
        ElNotification.error({
          title: 'Error',
          message: 'Error posting AI response'
        });
      }
    },
    async createNotification(userId, type, data) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        const { error } = await supabase
          .from('notifications')
          .insert([{
            user_id: userId,
            actor_id: user.id,
            type,
            data,
            read: false
          }]);

        if (error) throw error;
      } catch (error) {
        console.error('Error creating notification:', error);
      }
    },
    setupRealtimeSubscription() {
      if (this.subscription) {
        this.subscription.unsubscribe();
      }
      
      this.subscription = supabase
        .channel('task-comments-and-tasks-changes')
        .on('postgres_changes', 
          { 
            event: '*',
            schema: 'public',
            table: 'task_comments',
            filter: `task_id=eq.${this.task.id}`
          },
          async (payload) => {
            switch (payload.eventType) {
              case 'INSERT':
                // Load user email for new comment if not already cached
                if (!this.userEmails[payload.new.user_id]) {
                  const { data: userData } = await supabase
                    .rpc('get_user_info_by_id', {
                      user_id: payload.new.user_id
                    });
                  if (userData?.[0]) {
                    this.userEmails[payload.new.user_id] = userData[0].email;
                  }
                }
                // Add new comment to the beginning of the list
                this.comments.unshift(payload.new);
                // Update cache
                this.taskStore.updateCachedTaskDetail(this.task.id, { comments: this.comments });
                break;
              
              case 'UPDATE':
                const updateIndex = this.comments.findIndex(comment => comment.id === payload.new.id);
                if (updateIndex !== -1) {
                  this.comments[updateIndex] = payload.new;
                  // Update cache
                  this.taskStore.updateCachedTaskDetail(this.task.id, { comments: this.comments });
                }
                break;
              
              case 'DELETE':
                const deleteIndex = this.comments.findIndex(comment => comment.id === payload.old.id);
                if (deleteIndex !== -1) {
                  this.comments.splice(deleteIndex, 1);
                  // Update cache
                  this.taskStore.updateCachedTaskDetail(this.task.id, { comments: this.comments });
                }
                break;
            }
          }
        )
        .on('postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'tasks',
            filter: `matter_id=eq.${this.currentWorkspace.id}`
          },
          async (payload) => {
            try {
              // Only refresh cache if it's not an update to the current task or child tasks
              // to avoid unnecessary cache refreshes that cause flickering
              const isCurrentTask = payload.new?.id === this.task.id;
              const isChildTask = this.childTasks.some(child => child.id === payload.new?.id);
              
              if (!isCurrentTask && !isChildTask) {
                await this.taskStore.fetchAndCacheTasks(this.currentWorkspace.id);
              }
              
              // If the current task was updated, refresh it
              if (isCurrentTask) {
                this.task = { ...this.task, ...payload.new };
                this.taskStore.updateCachedTaskDetail(this.task.id, { task: this.task });
              }
            } catch (error) {
              console.error('Error handling realtime task update:', error);
            }
          }
        )
        .subscribe();
    },
    async loadSharedUsers() {
      try {
        const { data: shares, error } = await supabase
          .from('workspace_access')
          .select('shared_with_user_id')
          .eq('matter_id', this.currentWorkspace.id);

        if (error) throw error;

        const sharesWithUserInfo = await Promise.all(
          shares.map(async (share) => {
            const userInfo = await this.userStore.getUserInfo(share.shared_with_user_id);
            return {
              id: share.shared_with_user_id,
              email: userInfo?.email || 'Unknown User'
            };
          })
        );

        this.sharedUsers = sharesWithUserInfo;
      } catch (error) {
        ElNotification.error({
          title: 'Error',
          message: 'Error loading users: ' + error.message
        });
      }
    },
    async updateTask() {
      try {
        this.loading = true;
        const originalTask = { ...this.task };
        const { data: { user } } = await supabase.auth.getUser();

        // Prepare edit history entries
        const historyEntries = [];
        
        if (originalTask.title !== this.editingTask.title) {
          historyEntries.push({
            field_name: 'title',
            previous_value: originalTask.title,
            edited_at: new Date().toISOString(),
            edited_by: user.id
          });
        }

        if (originalTask.description !== this.editingTask.description) {
          historyEntries.push({
            field_name: 'description',
            previous_value: originalTask.description,
            edited_at: new Date().toISOString(),
            edited_by: user.id
          });
        }

        if (originalTask.log_hours !== this.editingTask.log_hours) {
          historyEntries.push({
            field_name: 'log_hours',
            previous_value: originalTask.log_hours || 0,
            edited_at: new Date().toISOString(),
            edited_by: user.id
          });
        }

        const updateData = {
          title: this.editingTask.title,
          description: this.editingTask.description,
          status: this.editingTask.status,
          priority: this.editingTask.priority,
          due_date: this.editingTask.due_date,
          assignee: this.editingTask.assignee,
          log_hours: parseInt(this.editingTask.log_hours || 0)
        };

        // If there are history entries, add them to the update
        if (historyEntries.length > 0) {
          updateData.edit_history = this.task.edit_history 
            ? [...this.task.edit_history, ...historyEntries]
            : historyEntries;
        }

        const { data, error } = await supabase
          .from('tasks')
          .update(updateData)
          .eq('id', this.task.id)
          .select();

        if (error) throw error;

        // Update local task data
        this.task = data[0];
        
        // Create notifications for changes
        if (originalTask.assignee !== this.editingTask.assignee && this.editingTask.assignee) {
          await this.createNotification(
            this.editingTask.assignee,
            'task_assigned',
            { task_id: this.task.id, task_title: this.task.title }
          );
        }

        // Log changes as activity
        const changes = [];
        if (originalTask.title !== this.editingTask.title) {
          changes.push(`title from "${originalTask.title}" to "${this.editingTask.title}"`);
        }
        if (originalTask.status !== this.editingTask.status) {
          changes.push(`status from "${originalTask.status}" to "${this.editingTask.status}"`);
        }
        if (originalTask.priority !== this.editingTask.priority) {
          changes.push(`priority from "${originalTask.priority}" to "${this.editingTask.priority}"`);
        }
        if (originalTask.assignee !== this.editingTask.assignee) {
          const oldAssignee = this.sharedUsers.find(u => u.id === originalTask.assignee)?.email || 'unassigned';
          const newAssignee = this.sharedUsers.find(u => u.id === this.editingTask.assignee)?.email || 'unassigned';
          changes.push(`assignee from ${oldAssignee} to ${newAssignee}`);
        }
        if (originalTask.due_date !== this.editingTask.due_date) {
          const oldDate = originalTask.due_date ? new Date(originalTask.due_date).toLocaleDateString() : 'none';
          const newDate = this.editingTask.due_date ? new Date(this.editingTask.due_date).toLocaleDateString() : 'none';
          changes.push(`due date from ${oldDate} to ${newDate}`);
        }
        if (originalTask.log_hours !== this.editingTask.log_hours) {
          changes.push(`logged hours from ${originalTask.log_hours || 0} to ${this.editingTask.log_hours || 0}`);
        }

        if (changes.length > 0) {
          await supabase
            .from('task_comments')
            .insert({
              task_id: this.task.id,
              user_id: user.id,
              content: `Updated ${changes.join(' and ')}`,
              type: 'activity',
              metadata: {
                action: 'update',
                changes: {
                  title: this.editingTask.title !== originalTask.title ? {
                    from: originalTask.title,
                    to: this.editingTask.title
                  } : null,
                  status: this.editingTask.status !== originalTask.status ? {
                    from: originalTask.status,
                    to: this.editingTask.status
                  } : null,
                  priority: this.editingTask.priority !== originalTask.priority ? {
                    from: originalTask.priority,
                    to: this.editingTask.priority
                  } : null,
                  assignee: this.editingTask.assignee !== originalTask.assignee ? {
                    from: originalTask.assignee,
                    to: this.editingTask.assignee
                  } : null,
                  due_date: this.editingTask.due_date !== originalTask.due_date ? {
                    from: originalTask.due_date,
                    to: this.editingTask.due_date
                  } : null,
                  log_hours: this.editingTask.log_hours !== originalTask.log_hours ? {
                    from: parseInt(originalTask.log_hours || 0),
                    to: parseInt(this.editingTask.log_hours || 0)
                  } : null
                }
              }
            });
        }

        this.editDialogVisible = false;
        ElNotification.success({
          title: 'Success',
          message: 'Task updated successfully'
        });
        
        // Reload task to get fresh data
        await this.loadTask(this.task.id, false);
      } catch (error) {
        ElNotification.error({
          title: 'Error',
          message: 'Error updating task: ' + error.message
        });
      } finally {
        this.loading = false;
      }
    },
    getStatusType(task) {
      if (!task) return 'info';
      switch (task.status) {
        case 'completed': return 'success';
        case 'in_progress': return 'warning';
        default: return 'info';
      }
    },
    formatStatus(status) {
      const statusMap = {
        'in_progress': 'In progress',
        'not_started': 'Not started',
        'not_needed_anymore': 'Not needed anymore',
        'completed': 'Completed',
        'awaiting_external': 'Awaiting external factor',
        'awaiting_internal': 'Awaiting internal factor'
      };
      return statusMap[status] || status;
    },
    generateShareLink() {
      const baseUrl = window.location.origin;
      this.shareLink = `${baseUrl}/single-workspace/${this.currentWorkspace.id}/tasks/${this.task.id}`;
    },
    async copyLink() {
      try {
        await navigator.clipboard.writeText(this.shareLink);
        ElNotification.success({
          title: 'Success',
          message: 'Link copied to clipboard'
        });
      } catch (error) {
        ElNotification.error({
          title: 'Error',
          message: 'Failed to copy link'
        });
      }
    },
    async shareViaEmail() {
      if (!this.emailShare.recipients.length) return;

      try {
        this.sending = true;
        const { data: { user } } = await supabase.auth.getUser();
        
        // Send email through your backend service
        const apiUrl = window.location.hostname === 'localhost' ? 'https://app.aiworkspace.pro/api/short-link' : '/api/short-link';
        const response = await fetch(`${apiUrl}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            taskId: this.task.id,
            recipients: this.emailShare.recipients,
            message: this.emailShare.message,
            sender: user.email,
            taskTitle: this.task.title,
            taskLink: this.shareLink
          })
        });

        if (!response.ok) throw new Error('Failed to send email');

        ElNotification.success({
          title: 'Success',
          message: 'Task shared successfully'
        });
        this.shareDialogVisible = false;
        this.emailShare.recipients = [];
        this.emailShare.message = '';
      } catch (error) {
        ElNotification.error({
          title: 'Error',
          message: 'Error sharing task: ' + error.message
        });
      } finally {
        this.sending = false;
      }
    },
    formatCommentContent(text) {
      if (!text) return '';
      
      const giteaHost = import.meta.env.VITE_GITEA_HOST;
      const giteaToken = import.meta.env.VITE_GITEA_TOKEN;
      // Regex for markdown links: [filename](url)
      const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
      // Image extensions to recognize
      const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
      
      return text.split('\n').map(line => line.trim()).join('<br>').replace(
        markdownLinkRegex,
        (match, fileName, fileUrl) => {
          let authenticatedUrl = fileUrl;
          // Only modify URLs that match the Gitea host
          if (fileUrl.startsWith(giteaHost)) {
            try {
              const url = new URL(fileUrl);
              url.searchParams.delete('token');
              url.searchParams.set('token', giteaToken);
              authenticatedUrl = url.toString().replace('??', '?');
            } catch (error) {
              console.error('Error creating authenticated URL:', error);
            }
          }
          // Check if the file is an image
          const ext = fileName.split('.').pop().toLowerCase();
          if (imageExtensions.includes(ext)) {
            // Render a thumbnail image, clickable to open full image
            return `<a class="file-link image-link" href="${authenticatedUrl}" target="_blank" title="Click to view image"><img src="${authenticatedUrl}" alt="${fileName}" style="max-width:120px;max-height:120px;object-fit:contain;border-radius:4px;border:1px solid #eee;margin:4px 0;display:inline-block;vertical-align:middle;" /></a>`;
          }
          // Otherwise, render as a normal file link
          return `<a class="file-link" href="${authenticatedUrl}" target="_blank" title="Click to view file">${fileName}</a>`;
        }
      );
    },
    renderHistoryContent(content) {
      if (!content) return '';
      
      // If the content contains HTML tags, render it as HTML
      if (content.includes('<') && content.includes('>')) {
        // Apply the same formatting as formatCommentContent for consistency
        const giteaHost = import.meta.env.VITE_GITEA_HOST;
        const giteaToken = import.meta.env.VITE_GITEA_TOKEN;
        const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
        const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
        
        return content.replace(
          markdownLinkRegex,
          (match, fileName, fileUrl) => {
            let authenticatedUrl = fileUrl;
            if (fileUrl.startsWith(giteaHost)) {
              try {
                const url = new URL(fileUrl);
                url.searchParams.delete('token');
                url.searchParams.set('token', giteaToken);
                authenticatedUrl = url.toString().replace('??', '?');
              } catch (error) {
                console.error('Error creating authenticated URL:', error);
              }
            }
            const ext = fileName.split('.').pop().toLowerCase();
            if (imageExtensions.includes(ext)) {
              return `<a class="file-link image-link" href="${authenticatedUrl}" target="_blank" title="Click to view image"><img src="${authenticatedUrl}" alt="${fileName}" style="max-width:120px;max-height:120px;object-fit:contain;border-radius:4px;border:1px solid #eee;margin:4px 0;display:inline-block;vertical-align:middle;" /></a>`;
            }
            return `<a class="file-link" href="${authenticatedUrl}" target="_blank" title="Click to view file">${fileName}</a>`;
          }
        );
      }
      
      // If it's plain text, apply the same formatting as formatCommentContent
      return this.formatCommentContent(content);
    },
    async loadFiles() {
      try {
        const giteaToken = import.meta.env.VITE_GITEA_TOKEN;
        const giteaHost = import.meta.env.VITE_GITEA_HOST;
        
        const { data: workspace, error: matterError } = await supabase
          .from('workspaces')
          .select('git_repo')
          .eq('id', this.currentWorkspace.id)
          .single();

        if (matterError) throw new Error('Failed to fetch workspace details');
        if (!workspace?.git_repo) throw new Error('No git repository found for this workspace');

        const path = this.currentSelectorFolder?.path || '';
        const response = await fetch(
          `${giteaHost}/api/v1/repos/associateattorney/${workspace.git_repo}/contents/${path}`,
          {
            headers: {
              'Authorization': `token ${giteaToken}`,
              'Accept': 'application/json',
              'Authorization': `token ${giteaToken}`,
              'Accept': 'application/json',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache'
            }
          }
        );

        if (!response.ok) throw new Error('Failed to fetch files');

        const contents = await response.json();
        
        // Separate files and folders
        this.folders = contents
          .filter(item => item.type === 'dir')
          .map(folder => ({
            id: folder.sha,
            name: folder.name,
            path: folder.path,
            type: 'dir'
          }));

        this.files = contents
          .filter(item => item.type === 'file' && item.name !== '.gitkeep')
          .map(file => ({
            id: file.sha,
            name: file.name,
            path: file.path,
            type: 'file',
            download_url: file.download_url
          }));

      } catch (error) {
        ElNotification.error({
          title: 'Error',
          message: 'Error loading files: ' + error.message
        });
        this.files = [];
        this.folders = [];
      }
    },

    handleInput(event) {
      const text = typeof event === 'string' ? event : event?.target?.value || '';
      
      // Get the current cursor position from the active textarea
      const textarea = document.activeElement;
      const selectionStart = textarea?.selectionStart || 0;
      
      const lastWord = text.slice(0, selectionStart).split(/\s+/).pop();
      
      if (lastWord === '@files') {
        this.showFileSelector = true;
        this.mentionIndex = selectionStart;
        this.loadFiles();
      }
    },

    selectFile(file) {
      // Determine which field we're editing
      const isEditingDescription = this.editDialogVisible;
      const text = isEditingDescription ? this.editingTask.description : this.newComment;
      
      const beforeMention = text.slice(0, this.mentionIndex - 6); // Remove '@files'
      const afterMention = text.slice(this.mentionIndex);
      const newText = `${beforeMention}[${file.name}](${file.download_url})${afterMention}`;
      
      // Update the appropriate field
      if (isEditingDescription) {
        this.editingTask.description = newText;
      } else {
        this.newComment = newText;
      }
      
      this.showFileSelector = false;
      this.fileSearchQuery = '';
    },

    startEditing(comment) {
      this.editingCommentId = comment.id;
      this.editingCommentText = comment.content;
    },

    cancelEditing() {
      this.editingCommentId = null;
      this.editingCommentText = '';
    },

    async saveCommentEdit(comment) {
      try {
        this.savingComment = true;
        const { error } = await supabase
          .from('task_comments')
          .update({ 
            content: this.editingCommentText,
            updated_at: new Date().toISOString(),
            comment_edit_history: [
              ...(comment.comment_edit_history || []),
              {
                previous_content: comment.content,
                edited_at: new Date().toISOString(),
                edited_by: this.currentUser.id
              }
            ]
          })
          .eq('id', comment.id);

        if (error) throw error;

        // Update local comment
        const commentIndex = this.comments.findIndex(c => c.id === comment.id);
        if (commentIndex !== -1) {
          this.comments[commentIndex] = {
            ...comment,
            content: this.editingCommentText,
            updated_at: new Date().toISOString()
          };
        }

        // Update workspace activity
        await updateMatterActivity(this.currentWorkspace.id);

        this.cancelEditing();
        ElNotification.success({
          title: 'Success',
          message: 'Comment updated successfully'
        });
      } catch (error) {
        console.error('Error updating comment:', error);
        ElNotification.error({
          title: 'Error',
          message: 'Failed to update comment'
        });
      } finally {
        this.savingComment = false;
      }
    },

    toggleHistory(commentId) {
      if (this.expandedCommentHistories.has(commentId)) {
        this.expandedCommentHistories.delete(commentId);
      } else {
        this.expandedCommentHistories.add(commentId);
      }
    },

    toggleTaskHistory() {
      this.showTaskHistory = !this.showTaskHistory;
    },

    async navigateSelectorFolder(folder) {
      try {
        if (!folder) {
          // Reset to root
          this.currentSelectorFolder = null;
          this.selectorBreadcrumbs = [];
        } else {
          // Find if folder exists in current breadcrumbs
          const existingIndex = this.selectorBreadcrumbs.findIndex(f => f.id === folder.id);
          
          if (existingIndex >= 0) {
            // Clicking a folder in breadcrumbs - truncate to that point
            this.selectorBreadcrumbs = this.selectorBreadcrumbs.slice(0, existingIndex + 1);
          } else {
            // New folder - add to breadcrumbs
            this.selectorBreadcrumbs.push(folder);
          }
          this.currentSelectorFolder = folder;
        }

        await this.loadFiles();
      } catch (error) {
        ElNotification.error({
          title: 'Error',
          message: 'Error navigating to folder: ' + error.message
        });
        this.currentSelectorFolder = null;
        this.selectorBreadcrumbs = [];
      }
    },

    async getTypeaheadSuggestions(text, cursorPosition) {
      try {
        const response = await fetch(`${this.pythonApiBaseUrl}/gpt/get_typeahead_suggestions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text,
            cursorPosition,
            systemPrompt: `Task context: ${this.task.title}. ${this.task.description || ''}`
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to get suggestions: ${errorText}`);
        }
        
        const data = await response.json();
        
        if (data.suggestions?.length) {
          this.typeaheadSuggestions = data.suggestions;
          this.showTypeahead = true;
          this.typeaheadSelectedIndex = -1;
        } else {
          this.showTypeahead = false;
        }
      } catch (error) {
        console.error('Error getting suggestions:', error);
        this.showTypeahead = false;
      }
    },

    handleDescriptionInput(event) {
      const text = typeof event === 'string' ? event : event?.target?.value || '';
      const cursorPos = typeof event === 'string' ? event.length : event?.target?.selectionStart || 0;

      if (this.typeaheadTimer) {
        clearTimeout(this.typeaheadTimer);
      }
      
      this.typeaheadTimer = setTimeout(() => {
        this.getTypeaheadSuggestions(text, cursorPos);
      }, 300);
    },

    applySuggestion(suggestion) {
      const textarea = document.querySelector('.description-input textarea');
      const cursorPos = textarea.selectionStart;
      const text = this.editingTask.description;
      
      const words = text.slice(0, cursorPos).split(' ');
      const lastWord = words[words.length - 1];
      
      words[words.length - 1] = suggestion;
      this.editingTask.description = words.join(' ') + text.slice(cursorPos);
      
      this.showTypeahead = false;
      this.typeaheadSuggestions = [];
      
      this.$nextTick(() => {
        const newPos = cursorPos - lastWord.length + suggestion.length;
        textarea.setSelectionRange(newPos, newPos);
        textarea.focus();
      });
    },

    handleTypeaheadNavigation(event) {
      if (!this.showTypeahead || !this.typeaheadSuggestions.length) return;

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          this.typeaheadSelectedIndex = Math.min(
            this.typeaheadSelectedIndex + 1,
            this.typeaheadSuggestions.length - 1
          );
          break;
        case 'ArrowUp':
          event.preventDefault();
          this.typeaheadSelectedIndex = Math.max(this.typeaheadSelectedIndex - 1, -1);
          break;
        case 'Tab':
        case 'Enter':
          event.preventDefault();
          if (this.typeaheadSelectedIndex >= 0) {
            this.applySuggestion(this.typeaheadSuggestions[this.typeaheadSelectedIndex]);
          }
          break;
        case 'Escape':
          this.showTypeahead = false;
          break;
      }
    },

    async loadHoursLogs() {
      try {
        const { data: logs, error } = await supabase
          .from('task_hours_logs')
          .select('*')
          .eq('task_id', this.task.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

         // Trim time_taken to HH:MM format
         const formattedLogs = logs.map(log => ({
          ...log,
          time_taken: log.time_taken ? log.time_taken.substring(0, 5) : null
        }));

        this.hoursLogs = formattedLogs;
        
        // Update cache
        this.taskStore.updateCachedTaskDetail(this.task.id, { hoursLogs: formattedLogs });

        // Load user emails for each log
        for (const log of logs) {
          if (!this.userEmails[log.user_id]) {
            const { data: userData } = await supabase
              .rpc('get_user_info_by_id', { user_id: log.user_id });
            if (userData?.[0]) {
              this.userEmails[log.user_id] = userData[0].email;
            }
          }
        }
      } catch (error) {
        ElNotification.error({
          title: 'Error',
          message: 'Error loading hours logs: ' + error.message
        });
      }
    },

    
    validateHours(value) {
      // Remove non-numeric characters
      let cleanValue = value.replace(/[^\d]/g, '');
      
      // Convert to number for validation
      let numValue = parseInt(cleanValue);
      
      // Validate range
      if (numValue > 12) {
        cleanValue = '12';
      }
      
      this.hours = cleanValue;
      this.updateTimeTaken();
    },

    validateMinutes(value) {
      // Remove non-numeric characters
      let cleanValue = value.replace(/[^\d]/g, '');
      
      // Convert to number for validation
      let numValue = parseInt(cleanValue);
      
      // Validate range
      if (numValue > 59) {
        cleanValue = '59';
      }
      
      this.minutes = cleanValue;
      this.updateTimeTaken();
    },

    formatHours() {
      if (this.hours) {
        // Pad with leading zero if needed
        this.hours = String(parseInt(this.hours)).padStart(2, '0');
      }
      this.validateTimeInput();
    },

    formatMinutes() {
      if (this.minutes) {
        // Pad with leading zero if needed
        this.minutes = String(parseInt(this.minutes)).padStart(2, '0');
      }
      this.validateTimeInput();
    },

    validateTimeInput() {
      const hours = parseInt(this.hours || '0');
      const minutes = parseInt(this.minutes || '0');

      if (hours === 0 && minutes === 0) {
        this.timeError = 'Time must be greater than 0';
        this.newHoursLog.time_taken = null;
        return false;
      }

      if (hours < 0 || hours > 12) {
        this.timeError = 'Hours must be between 0 and 12';
        this.newHoursLog.time_taken = null;
        return false;
      }

      if (minutes < 0 || minutes > 59) {
        this.timeError = 'Minutes must be between 0 and 59';
        this.newHoursLog.time_taken = null;
        return false;
      }

      this.timeError = '';
      return true;
    },
    handleMinutesKeydown(event) {
      // If backspace is pressed and minutes is empty, move to hours input
      if (event.key === 'Backspace' && !this.minutes) {
        this.$refs.hoursInput.$el.querySelector('input').focus();
      }
    },

    updateTimeTaken() {
      if (this.validateTimeInput()) {
        const formattedHours = String(parseInt(this.hours || '0')).padStart(2, '0');
        const formattedMinutes = String(parseInt(this.minutes || '0')).padStart(2, '0');
        this.newHoursLog.time_taken = `${formattedHours}:${formattedMinutes}:00`;
      }
    },

    resetTimeInputs() {
      this.hours = '';
      this.minutes = '';
      this.timeError = '';
      this.newHoursLog.time_taken = null;
    },

    async submitHoursLog() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        const { error } = await supabase
          .from('task_hours_logs')
          .insert({
            task_id: this.task.id,
            user_id: user.id,
            time_taken: this.newHoursLog.time_taken,
            comment: this.newHoursLog.comment,
            matter_id: this.task.matter_id
          });

        if (error) throw error;

        // Update workspace activity
        await updateMatterActivity(this.currentWorkspace.id);

        this.logHoursDialogVisible = false;
        this.newHoursLog = { time_taken: null, comment: '' };
        this.resetTimeInputs();
        await this.loadHoursLogs();
        ElNotification.success({
          title: 'Success',
          message: 'Hours logged successfully'
        });
      } catch (error) {
        ElNotification.error({
          title: 'Error',
          message: 'Error logging hours: ' + error.message
        });
      }
    },
    
    handleHoursKeyup(event) {
      // If 2 digits entered in hours, move to minutes
      if (this.hours.length === 2 && parseInt(this.hours) <= 12) {
        this.$refs.minutesInput.$el.querySelector('input').focus();
      }
    },

    toggleShowMore() {
      this.showAllLogs = !this.showAllLogs;
      this.displayedHoursLogs = this.showAllLogs ? this.hoursLogs : this.hoursLogs.slice(0, 3);
    },

    updateDueDate() {
      this.task.due_date = this.tempDueDate;
      this.closeDueDatePopover();
    },
    closeDueDatePopover() {
      this.$refs.dueDatePopover.close();
    },
    startTitleEdit() {
      this.isEditingTitle = true;
      this.editingTitle = this.task?.title || '';
    },
    cancelTitleEdit() {
      this.isEditingTitle = false;
      this.editingTitle = '';
    },
    startDescriptionEdit() {
      this.isEditingDescription = true;
      this.editingDescription = this.task?.description || '';
    },
    cancelDescriptionEdit() {
      this.isEditingDescription = false;
      this.editingDescription = '';
    },
    async updateParentTask(parentTaskId) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        // Convert empty string to null for database
        const newParentTaskId = parentTaskId === '' ? null : parentTaskId;
        
        const { error } = await supabase
          .from('tasks')
          .update({ 
            parent_task_id: newParentTaskId,
            updated_at: new Date().toISOString()
          })
          .eq('id', this.task.id);

        if (error) throw error;

        // Update local task data
        this.task.parent_task_id = newParentTaskId;
        
        // Update cache
        this.taskStore.updateCachedTaskDetail(this.task.id, { task: this.task });
        
        // Create activity log
        const newParentTask = this.flattenedTasks.find(t => t.id === parentTaskId);
        const activityMessage = parentTaskId 
          ? `Set parent task to "${newParentTask.title}"`
          : 'Removed parent task';

        await supabase
          .from('task_comments')
          .insert({
            task_id: this.task.id,
            user_id: user.id,
            content: activityMessage,
            type: 'activity',
            matter_id: this.task.matter_id,
            metadata: {
              action: 'update',
              changes: {
                parent_task_id: {
                  from: this.task.parent_task_id,
                  to: newParentTaskId
                }
              }
            }
          });

        // Update workspace activity
        await updateMatterActivity(this.currentWorkspace.id);

        ElNotification.success({
          title: 'Success',
          message: activityMessage
        });
      } catch (error) {
        console.error('Error updating parent task:', error);
        ElNotification.error({
          title: 'Error',
          message: 'Failed to update parent task'
        });
      }
    },
    organizeTasksHierarchy(tasks) {
      // Create a map of all tasks
      const taskMap = new Map(tasks.map(task => [task.id, { ...task, children: [] }]));
      const rootTasks = [];

      // Organize tasks into hierarchy
      for (const task of taskMap.values()) {
        if (task.parent_task_id && taskMap.has(task.parent_task_id)) {
          taskMap.get(task.parent_task_id).children.push(task);
        } else {
          rootTasks.push(task);
        }
      }

      return rootTasks;
    },
    async toggleArchiveComment(comment) {
      try {
        const newArchivedState = !comment.archived;
        const { error } = await supabase
          .from('task_comments')
          .update({ 
            archived: newArchivedState,
            updated_at: new Date().toISOString()
          })
          .eq('id', comment.id);

        if (error) throw error;

        // Update local comment
        comment.archived = newArchivedState;
        
        // Update workspace activity
        await updateMatterActivity(this.currentWorkspace.id);
        
        ElNotification.success({
          title: 'Success',
          message: `Comment ${newArchivedState ? 'archived' : 'unarchived'} successfully`
        });
        
        await this.loadComments();
      } catch (error) {
        console.error('Error toggling comment archive:', error);
        ElNotification.error({
          title: 'Error',
          message: 'Failed to update comment archive status'
        });
      }
    },
    toggleCommentHistory(comment) {
      if (this.expandedCommentHistories.has(comment.id)) {
        this.expandedCommentHistories.delete(comment.id);
      } else {
        this.expandedCommentHistories.add(comment.id);
      }
    },
    toggleArchived() {
      this.showArchivedComments = !this.showArchivedComments;
      this.loadComments();
    },
    startStatusEdit() {
      this.isEditingStatus = true;
    },
    formatPriority(priority) {
      if (!priority) return 'Not set';
      return priority.charAt(0).toUpperCase() + priority.slice(1);
    },
    getPriorityType(task) {
      if (!task?.priority) return '';
      switch (task.priority) {
        case 'high': return 'danger';
        case 'medium': return 'warning';
        case 'low': return 'info';
        default: return '';
      }
    },
    startPriorityEdit() {
      this.isEditingPriority = true;
    },
    startAssigneeEdit() {
      this.isEditingAssignee = true;
    },
    showDueDatePopover() {
      this.tempDueDate = this.task?.due_date;
      this.dueDatePopoverVisible = true;
    },
    saveDueDate() {
      this.task.due_date = this.tempDueDate;
      this.closeDueDatePopover();
      ElNotification.success({
        title: 'Success',
        message: 'Due date updated successfully'
      });
    },
    initializeTempDueDate() {
      this.tempDueDate = this.task?.due_date ? new Date(this.task.due_date) : null;
    },
    async downloadResponse(comment, format) {
      try {
        // Create content with task context
        const content = `
${comment.content}
        `;

        if (format === 'doc') {
          // Create blob for .doc format
          const blob = new Blob([content], { type: 'application/msword' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `task-${this.task.id}-response-${comment.id}.doc`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        } else if (format === 'pdf') {
          // Convert content to PDF using jsPDF
          const { jsPDF } = window.jspdf;
          const doc = new jsPDF();
          
          // Add content to PDF
          const splitText = doc.splitTextToSize(content, 180);
          doc.text(splitText, 15, 15);
          
          // Download PDF
          doc.save(`task-${this.task.id}-response-${comment.id}.pdf`);
        }

        ElNotification.success({
          title: 'Success',
          message: `Downloaded response as ${format.toUpperCase()}`
        });
      } catch (error) {
        console.error('Error downloading response:', error);
        ElNotification.error({
          title: 'Error',
          message: 'Failed to download response'
        });
      }
    },
    navigateToTask(taskId) {
      this.$router.push(`/single-workspace/${this.currentWorkspace.id}/tasks/${taskId}`);
    },
    getDueDateTagType(dueDate) {
      const today = new Date();
      const taskDate = new Date(dueDate);
      const diffDays = Math.ceil((taskDate - today) / (1000 * 60 * 60 * 24));
      
      if (diffDays < 0) return 'danger';
      if (diffDays <= 3) return 'warning';
      return 'info';
    },
    getTaskIndentation(task) {
      const tasks = this.taskStore.getCachedTasks(this.currentWorkspace?.id) || [];
      let level = 0;
      let currentTask = task;
      
      while (currentTask.parent_task_id && currentTask.parent_task_id !== this.task.id) {
        level++;
        currentTask = tasks.find(t => t.id === currentTask.parent_task_id);
        if (!currentTask) break;
      }
      
      return level * 24;
    },
    // Add these helper methods
    getPredecessorIds(taskId, taskMap) {
      const predecessorIds = new Set();
      let currentTaskId = taskId;
      
      while (currentTaskId) {
        const currentTask = taskMap.get(currentTaskId);
        if (!currentTask || predecessorIds.has(currentTaskId)) break;
        predecessorIds.add(currentTaskId);
        currentTaskId = currentTask.parent_task_id;
      }
      
      return Array.from(predecessorIds);
    },

    getDescendantIds(taskId, taskMap) {
      const descendantIds = new Set();
      
      const addDescendants = (id) => {
        const tasks = Array.from(taskMap.values());
        const children = tasks.filter(t => t.parent_task_id === id);
        
        children.forEach(child => {
          descendantIds.add(child.id);
          addDescendants(child.id);
        });
      };
      
      addDescendants(taskId);
      return Array.from(descendantIds);
    },



    async createChildTask() {
      if (!this.newChildTask.title.trim()) return;

      try {
        this.creatingChildTask = true;
        const { data: { user } } = await supabase.auth.getUser();

        const taskData = {
          title: this.newChildTask.title.trim(),
          description: this.newChildTask.description,
          status: this.newChildTask.status,
          priority: this.newChildTask.priority,
          due_date: this.newChildTask.due_date,
          assignee: this.newChildTask.assignee,
          matter_id: this.currentWorkspace.id,
          parent_task_id: this.task.id,
          created_by: user.id
        };

        const { data, error } = await supabase
          .from('tasks')
          .insert(taskData)
          .select()
          .single();

        if (error) throw error;

        // Create activity log for parent task
        await supabase
          .from('task_comments')
          .insert({
            task_id: this.task.id,
            user_id: user.id,
            content: `Created child task: "${this.newChildTask.title}"`,
            type: 'activity',
            matter_id: this.task.matter_id,
            metadata: {
              action: 'create_child',
              child_task_id: data.id,
              child_task_title: this.newChildTask.title
            }
          });

        // Create notification for assignee if assigned
        if (this.newChildTask.assignee) {
          await this.createNotification(
            this.newChildTask.assignee,
            'task_assigned',
            { 
              task_id: data.id, 
              task_title: this.newChildTask.title,
              parent_task_title: this.task.title
            }
          );
        }

        // Send Telegram notification
        await sendTelegramNotification({
          workspaceId: this.currentWorkspace.id,
          activityType: 'CHILD_TASK_CREATED',
          message: `Child task created under "${this.task.title}"\n\nChild Task: "${this.newChildTask.title}"\nCreated by: ${user.email}`
        });

        // Update workspace activity
        await updateMatterActivity(this.currentWorkspace.id);

        // Reset form
        this.resetChildTaskForm();
        this.createChildTaskDialogVisible = false;
        
        ElNotification.success({
          title: 'Success',
          message: 'Child task created successfully'
        });
      } catch (error) {
        console.error('Error creating child task:', error);
        ElNotification.error({
          title: 'Error',
          message: 'Failed to create child task: ' + error.message
        });
      } finally {
        this.creatingChildTask = false;
      }
    },

    resetChildTaskForm() {
      this.newChildTask = {
        title: '',
        description: '',
        status: 'not_started',
        priority: 'medium',
        due_date: null,
        assignee: null
      };
    },

    async handleChildTaskStatusChange(childTask, newStatus) {
      try {
        this.updatingChildTasks.add(childTask.id);
        const { data: { user } } = await supabase.auth.getUser();
        
        const oldStatus = childTask.status;
        
        const { error } = await supabase
          .from('tasks')
          .update({ 
            status: newStatus,
            updated_at: new Date().toISOString()
          })
          .eq('id', childTask.id);

        if (error) throw error;

        // Update local state immediately
        childTask.status = newStatus;
        
        // Also update the task in the task store cache if it exists
        const cachedTasks = this.taskStore.getCachedTasks(this.currentWorkspace.id) || [];
        const taskIndex = cachedTasks.findIndex(t => t.id === childTask.id);
        if (taskIndex !== -1) {
          cachedTasks[taskIndex].status = newStatus;
        }
        
        // Create activity log for the child task
        await supabase
          .from('task_comments')
          .insert({
            task_id: childTask.id,
            user_id: user.id,
            content: `Updated status from "${this.formatStatus(oldStatus)}" to "${this.formatStatus(newStatus)}"`,
            type: 'activity',
            matter_id: this.currentWorkspace.id,
            metadata: {
              action: 'update',
              changes: {
                status: {
                  from: oldStatus,
                  to: newStatus
                }
              }
            }
          });

        // Send Telegram notification (optional - don't fail if no groups configured)
        try {
          await sendTelegramNotification({
            workspaceId: this.currentWorkspace.id,
            activityType: 'CHILD_TASK_STATUS_UPDATED',
            message: `Child task status updated: "${childTask.title}"\nFrom: ${this.formatStatus(oldStatus)} → To: ${this.formatStatus(newStatus)}\nParent: "${this.task.title}"`
          });
        } catch (telegramError) {
          console.warn('Telegram notification failed:', telegramError.message);
          // Continue without failing the status update
        }

        // Update workspace activity
        await updateMatterActivity(this.currentWorkspace.id);

        ElNotification.success({
          title: 'Success',
          message: 'Child task status updated successfully'
        });
        
        // Close the popover
        this.childTaskPopoverVisibility.status[childTask.id] = false;
      } catch (error) {
        console.error('Error updating child task status:', error);
        ElNotification.error({
          title: 'Error',
          message: 'Failed to update child task status'
        });
      } finally {
        this.updatingChildTasks.delete(childTask.id);
      }
    },

    async handleChildTaskPriorityChange(childTask, newPriority) {
      try {
        this.updatingChildTasks.add(childTask.id);
        const { data: { user } } = await supabase.auth.getUser();
        
        const oldPriority = childTask.priority;
        
        const { error } = await supabase
          .from('tasks')
          .update({ 
            priority: newPriority,
            updated_at: new Date().toISOString()
          })
          .eq('id', childTask.id);

        if (error) throw error;

        // Update local state immediately
        childTask.priority = newPriority;
        
        // Also update the task in the task store cache if it exists
        const cachedTasks = this.taskStore.getCachedTasks(this.currentWorkspace.id) || [];
        const taskIndex = cachedTasks.findIndex(t => t.id === childTask.id);
        if (taskIndex !== -1) {
          cachedTasks[taskIndex].priority = newPriority;
        }
        
        // Create activity log for the child task
        await supabase
          .from('task_comments')
          .insert({
            task_id: childTask.id,
            user_id: user.id,
            content: `Updated priority from "${this.formatPriority(oldPriority)}" to "${this.formatPriority(newPriority)}"`,
            type: 'activity',
            matter_id: this.currentWorkspace.id,
            metadata: {
              action: 'update',
              changes: {
                priority: {
                  from: oldPriority,
                  to: newPriority
                }
              }
            }
          });

        // Send Telegram notification (optional - don't fail if no groups configured)
        try {
          await sendTelegramNotification({
            workspaceId: this.currentWorkspace.id,
            activityType: 'CHILD_TASK_PRIORITY_UPDATED',
            message: `Child task priority updated: "${childTask.title}"\nFrom: ${this.formatPriority(oldPriority)} → To: ${this.formatPriority(newPriority)}\nParent: "${this.task.title}"`
          });
        } catch (telegramError) {
          console.warn('Telegram notification failed:', telegramError.message);
          // Continue without failing the priority update
        }

        // Update workspace activity
        await updateMatterActivity(this.currentWorkspace.id);

        ElNotification.success({
          title: 'Success',
          message: 'Child task priority updated successfully'
        });
        
        // Close the popover
        this.childTaskPopoverVisibility.priority[childTask.id] = false;
      } catch (error) {
        console.error('Error updating child task priority:', error);
        ElNotification.error({
          title: 'Error',
          message: 'Failed to update child task priority'
        });
      } finally {
        this.updatingChildTasks.delete(childTask.id);
      }
    },

    sortBy(column) {
      if (this.sortColumn === column) {
        // If clicking the same column, toggle direction
        this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        // If clicking a new column, set it as active with appropriate default direction
        this.sortColumn = column;
        this.sortDirection = column === 'priority' ? 'desc' : 'asc'; // Priority defaults to desc (high to low)
      }
    },

    loadUserSettings() {
      // Load user-specific settings from localStorage
      const userId = this.currentUser?.id;
      if (userId) {
        const settingsKey = `task-settings-${userId}`;
        const savedSettings = localStorage.getItem(settingsKey);
        if (savedSettings) {
          try {
            const settings = JSON.parse(savedSettings);
            this.showCompletedTasks = settings.showCompletedTasks !== undefined ? settings.showCompletedTasks : true;
          } catch (error) {
            console.error('Error loading user settings:', error);
            this.showCompletedTasks = true;
          }
        }
      }
    },

    saveUserSettings() {
      // Save user-specific settings to localStorage
      const userId = this.currentUser?.id;
      if (userId) {
        const settingsKey = `task-settings-${userId}`;
        const settings = {
          showCompletedTasks: this.showCompletedTasks
        };
        localStorage.setItem(settingsKey, JSON.stringify(settings));
      }
    },

    onShowCompletedChange() {
      this.saveUserSettings();
      ElNotification.success({
        title: 'Success',
        message: `Completed tasks ${this.showCompletedTasks ? 'shown' : 'hidden'}`
      });
    },

    async refreshTaskCache() {
      // Refresh the task store cache to ensure we have the latest task data
      if (this.currentWorkspace?.id) {
        await this.taskStore.fetchAndCacheTasks(this.currentWorkspace.id);
      }
    },

    async refreshCurrentTaskDetail() {
      // Force refresh the current task detail cache
      const taskId = this.$route.params.taskId;
      if (taskId) {
        this.taskStore.clearTaskDetailCache(taskId);
        await this.loadTask(taskId, false);
      }
    },
    async loadTaskOutline() {
      try {
        this.outlineLoading = true;
        
        // Try to load existing task outline from the main outlines table
        // We'll use a unique title format to distinguish task outlines
        const outlineTitle = `Task_${this.task.id}_Outline`;
        
        const { data: existingOutline, error } = await supabase
          .from('outlines')
          .select('*')
          .eq('matter_id', this.currentWorkspace.id)
          .eq('title', outlineTitle)
          .order('version', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.error('Error loading task outline:', error);
          // Initialize with empty outline if no existing outline
          this.taskOutline = [];
        } else if (existingOutline) {
          this.taskOutline = existingOutline.content || [];
          this.lastSavedOutlineContent = JSON.parse(JSON.stringify(this.taskOutline));
        } else {
          // No existing outline, start with empty
          this.taskOutline = [];
          this.lastSavedOutlineContent = [];
        }
        
        this.hasOutlineChanges = false;
      } catch (error) {
        console.error('Error loading task outline:', error);
        this.taskOutline = [];
      } finally {
        this.outlineLoading = false;
      }
    },

    async saveTaskOutline() {
      try {
        this.savingOutline = true;
        const { data: { user } } = await supabase.auth.getUser();

        const outlineTitle = `Task_${this.task.id}_Outline`;
        const outlineToSave = JSON.parse(JSON.stringify(this.taskOutline));

        // Check if outline already exists
        const { data: existingOutline } = await supabase
          .from('outlines')
          .select('id, version')
          .eq('matter_id', this.currentWorkspace.id)
          .eq('title', outlineTitle)
          .order('version', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingOutline) {
          // Update existing outline
          const { data: newVersion, error: versionError } = await supabase
            .rpc('increment_version', { outline_id: existingOutline.id });

          if (versionError) throw versionError;

          const { error: updateError } = await supabase
            .from('outlines')
            .update({
              content: outlineToSave,
              version: newVersion,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingOutline.id);

          if (updateError) throw updateError;

          // Create version record
          const { error: versionRecordError } = await supabase
            .from('outline_versions')
            .insert([{
              outline_id: existingOutline.id,
              content: outlineToSave,
              version: newVersion,
              created_by: user.id
            }]);

          if (versionRecordError) throw versionRecordError;
        } else {
          // Create new outline
          const { data: newOutline, error: insertError } = await supabase
            .from('outlines')
            .insert([{
              matter_id: this.currentWorkspace.id,
              title: outlineTitle,
              content: outlineToSave,
              created_by: user.id
            }])
            .select()
            .single();

          if (insertError) throw insertError;

          // Create initial version record
          const { error: versionError } = await supabase
            .from('outline_versions')
            .insert([{
              outline_id: newOutline.id,
              content: outlineToSave,
              version: newOutline.version,
              created_by: user.id
            }]);

          if (versionError) throw versionError;
        }

        // Create activity log for the task
        await supabase
          .from('task_comments')
          .insert({
            task_id: this.task.id,
            user_id: user.id,
            content: 'Updated task outline',
            type: 'activity',
            matter_id: this.task.matter_id,
            metadata: {
              action: 'outline_update',
              outline_items_count: this.taskOutline.length
            }
          });
        
        // Update workspace activity
        await updateMatterActivity(this.currentWorkspace.id);

        this.lastSavedOutlineContent = JSON.parse(JSON.stringify(outlineToSave));
        this.hasOutlineChanges = false;

        ElNotification.success({
          title: 'Success',
          message: 'Task outline saved successfully'
        });

      } catch (error) {
        console.error('Error saving task outline:', error);
        ElNotification.error({
          title: 'Error',
          message: 'Error saving task outline: ' + error.message
        });
      } finally {
        this.savingOutline = false;
      }
    },

    onTaskOutlineUpdate(data) {
      // Find and update the specific outline item
      const updateItem = (items) => {
        for (let i = 0; i < items.length; i++) {
          if (items[i].id === data.id) {
            items[i] = { ...items[i], ...data };
            return true;
          }
          if (items[i].children && updateItem(items[i].children)) {
            return true;
          }
        }
        return false;
      };

      updateItem(this.taskOutline);
      this.hasOutlineChanges = this.checkOutlineChanges();
    },

    handleTaskOutlineMove(payload) {
      // Handle moving outline items (drag and drop)
      const { draggedId, targetId, position } = payload;
      
      // Find and remove the dragged item
      let draggedItem = null;
      const removeItem = (items) => {
        for (let i = 0; i < items.length; i++) {
          if (items[i].id.toString() === draggedId.toString()) {
            draggedItem = items.splice(i, 1)[0];
            return true;
          }
          if (items[i].children && removeItem(items[i].children)) {
            return true;
          }
        }
        return false;
      };

      // Find the target and insert the dragged item
      const insertItem = (items) => {
        for (let i = 0; i < items.length; i++) {
          if (items[i].id.toString() === targetId.toString()) {
            if (position === 'before') {
              items.splice(i, 0, draggedItem);
            } else if (position === 'after') {
              items.splice(i + 1, 0, draggedItem);
            } else if (position === 'child') {
              if (!items[i].children) items[i].children = [];
              items[i].children.push(draggedItem);
            }
            return true;
          }
          if (items[i].children && insertItem(items[i].children)) {
            return true;
          }
        }
        return false;
      };

      if (removeItem(this.taskOutline) && draggedItem) {
        insertItem(this.taskOutline);
        this.hasOutlineChanges = true;
      }
    },

    handleTaskOutlineDelete(id) {
      // Remove item from outline
      const removeItem = (items) => {
        for (let i = 0; i < items.length; i++) {
          if (items[i].id === id) {
            items.splice(i, 1);
            return true;
          }
          if (items[i].children && removeItem(items[i].children)) {
            return true;
          }
        }
        return false;
      };

      removeItem(this.taskOutline);
      this.hasOutlineChanges = this.checkOutlineChanges();
    },

    handleTaskOutlineNavigate({ id, direction }) {
      // Flatten the outline for navigation
      const flattenOutline = (items) => {
        const result = [];
        const traverse = (items) => {
          items.forEach(item => {
            result.push(item);
            if (item.children && item.children.length > 0) {
              traverse(item.children);
            }
          });
        };
        traverse(items);
        return result;
      };

      const flat = flattenOutline(this.taskOutline);
      const idx = flat.findIndex(item => item.id.toString() === id.toString());
      if (idx === -1) return;

      let targetIdx = null;
      if (direction === 'up' && idx > 0) targetIdx = idx - 1;
      if (direction === 'down' && idx < flat.length - 1) targetIdx = idx + 1;

      if (targetIdx !== null) {
        // Set autoFocus for the target item
        Object.assign(flat[targetIdx], { autoFocus: true });
        // Force reactivity
        this.taskOutline = [...this.taskOutline];
      }
    },

    handleTaskOutlineIndent({ id }) {
      // Find parent and previous sibling
      const findParentAndIndex = (items, id, parent = null) => {
        for (let i = 0; i < items.length; i++) {
          if (items[i].id.toString() === id.toString()) {
            return { parent, index: i, items };
          }
          if (items[i].children && items[i].children.length) {
            const res = findParentAndIndex(items[i].children, id, items[i]);
            if (res) return res;
          }
        }
        return null;
      };

      const res = findParentAndIndex(this.taskOutline, id);
      if (!res || res.index === 0) return; // No previous sibling

      const { parent, index, items } = res;
      const prevSibling = items[index - 1];
      
      // Remove from current position
      const [moved] = items.splice(index, 1);
      
      // Add as last child of previous sibling
      if (!prevSibling.children) prevSibling.children = [];
      prevSibling.children.push(moved);
      
      // Set autoFocus for moved node
      moved.autoFocus = true;
      this.taskOutline = [...this.taskOutline];
      this.hasOutlineChanges = true;
    },

    handleTaskOutlineOutdent({ id }) {
      // Find the node, its parent, and its grandparent
      const findNodeAndAncestors = (items, id, parent = null, grandparent = null) => {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.id.toString() === id.toString()) {
            return { node: item, parent, grandparent, index: i, items };
          }
          if (item.children && item.children.length) {
            const res = findNodeAndAncestors(item.children, id, item, parent);
            if (res) return res;
          }
        }
        return null;
      };

      const res = findNodeAndAncestors(this.taskOutline, id);
      if (!res || !res.parent) {
        return; // Cannot outdent root level items
      }

      const { parent, grandparent, index, items } = res;

      // Remove from current position
      const [moved] = items.splice(index, 1);

      if (grandparent) {
        // Find parent in grandparent's children
        const gpChildren = grandparent.children;
        const parentIdx = gpChildren.findIndex(child => child.id === parent.id);
        if (parentIdx !== -1) {
          gpChildren.splice(parentIdx + 1, 0, moved);
        }
      } else {
        // Parent is at root level, move to root
        const parentIdx = this.taskOutline.findIndex(item => item.id === parent.id);
        if (parentIdx !== -1) {
          this.taskOutline.splice(parentIdx + 1, 0, moved);
        }
      }

      // Set autoFocus for moved node
      moved.autoFocus = true;
      this.taskOutline = [...this.taskOutline];
      this.hasOutlineChanges = true;
    },

    handleTaskOutlineAddSibling({ id }) {
      // Handle adding sibling or first item
      if (id === null) {
        // Special case: adding first item
        const newItem = {
          id: Date.now().toString(),
          text: '',
          children: [],
          autoFocus: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        this.taskOutline.push(newItem);
        this.hasOutlineChanges = true;
        return;
      }

      // Add a sibling item after the target item
      const addSibling = (items, targetId) => {
        for (let i = 0; i < items.length; i++) {
          if (items[i].id === targetId) {
            const newItem = {
              id: Date.now().toString(),
              text: '',
              children: [],
              autoFocus: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };
            items.splice(i + 1, 0, newItem);
            return true;
          }
          if (items[i].children && addSibling(items[i].children, targetId)) {
            return true;
          }
        }
        return false;
      };

      // Try adding at root level first
      const rootIndex = this.taskOutline.findIndex(item => item.id === id);
      if (rootIndex !== -1) {
        const newItem = {
          id: Date.now().toString(),
          text: '',
          children: [],
          autoFocus: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        this.taskOutline.splice(rootIndex + 1, 0, newItem);
        this.hasOutlineChanges = true;
        return;
      }

      // Otherwise search recursively
      if (addSibling(this.taskOutline, id)) {
        this.hasOutlineChanges = true;
      }
    },

    checkOutlineChanges() {
      if (!this.lastSavedOutlineContent) return this.taskOutline.length > 0;
      const currentContent = JSON.stringify(this.taskOutline);
      const savedContent = JSON.stringify(this.lastSavedOutlineContent);
      return currentContent !== savedContent;
    },

    async handleGenerateExternalShareLink() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        await this.generateExternalShareLink(this.task.id, user.id);
      } catch (error) {
        console.error('Error generating external share link:', error);
      }
    },

    async handleRevokeExternalShareLink() {
      try {
        await this.revokeExternalShareLink(this.task.id);
      } catch (error) {
        console.error('Error revoking external share link:', error);
      }
    },

    async handleRevokeSpecificExternalLink(shareId) {
      try {
        await this.revokeSpecificExternalShareLink(shareId);
      } catch (error) {
        console.error('Error revoking specific external share link:', error);
      }
    },

    async handleCopyExternalLink() {
      try {
        await this.copyExternalLink();
      } catch (error) {
        console.error('Error copying external link:', error);
      }
    },

    async handleCopySpecificExternalLink(shortId) {
      try {
        const baseUrl = window.location.origin;
        const linkToCopy = `${baseUrl}/short-link/${shortId}`;
        await navigator.clipboard.writeText(linkToCopy);
        ElMessage.success('External share link copied to clipboard');
      } catch (error) {
        console.error('Error copying specific external link:', error);
        ElMessage.error('Failed to copy external share link');
      }
    },

    formatDate(dateString) {
      if (!dateString) return '';
      const date = new Date(dateString);
      return date.toLocaleDateString();
    },

    async handleLoadExternalShareHistory() {
      try {
        await this.loadExternalShareHistory(this.task.id);
      } catch (error) {
        console.error('Error loading external share history:', error);
      }
    },

    getCommentAuthor(comment) {
      if (comment.type === 'ai_response') {
        return comment.metadata?.ai_name || 'AI Attorney';
      } else if (comment.type === 'activity') {
        return 'System';
      } else if (comment.external_user_email) {
        return comment.external_user_email;
      } else if (comment.user_id) {
        return this.userEmails[comment.user_id] || 'Team Member';
      } else {
        return 'Unknown User';
      }
    },

         async loadEsignDocuments() {
       try {
         this.esignLoading = true;
         const { data: documents, error } = await supabase
           .from('task_documents')
           .select('*')
           .eq('task_id', this.task.id)
           .eq('requires_signature', true);

         if (error) throw error;

         this.esignDocuments = documents || [];
         // Fetch signatures for each document
         for (const doc of this.esignDocuments) {
           doc.signatures = await this.fetchSignaturesForDocument(doc.id);
         }
       } catch (error) {
         console.error('Error loading e-sign documents:', error);
         this.esignDocuments = [];
       } finally {
         this.esignLoading = false;
       }
     },

    handlePdfFileChange(file, fileList) {
      this.uploadFileList = fileList;
    },

    handlePdfFileRemove(file, fileList) {
      this.uploadFileList = fileList;
    },

    beforePdfUpload(file) {
      const isPdf = file.type === 'application/pdf';
      if (!isPdf) {
        ElNotification.error({
          title: 'Error',
          message: 'Please upload a PDF file'
        });
      }
      return isPdf;
    },

         async uploadPdfDocument() {
       if (!this.uploadFileList.length) return;
       // Instead of uploading immediately, open the signature position modal
       const file = this.uploadFileList[0].raw;
       this.pendingPdfFileObj = file;
       this.pendingPdfFileName = file.name;
       this.pendingPdfFile = URL.createObjectURL(file);
       this.showSignaturePositionModal = true;
     },

    getSignatureStatusType(status) {
      switch (status) {
        case 'signed': return 'success';
        case 'pending': return 'warning';
        case 'rejected': return 'danger';
        default: return 'info';
      }
    },

    formatSignatureStatus(status) {
      switch (status) {
        case 'signed': return 'Signed';
        case 'pending': return 'Pending';
        case 'rejected': return 'Rejected';
        default: return 'Unknown';
      }
    },

         async viewDocument(document) {
       try {
         // For signed documents, show additional information in a notification
         if (document.signature_status === 'signed' && document.signatures?.length > 0) {
           const signatures = document.signatures;
           const signatureCount = signatures.length;
           
           ElNotification({
             title: `Viewing Signed Document`,
             message: `This document contains ${signatureCount} digital signature${signatureCount > 1 ? 's' : ''} and has been legally executed.`,
             type: 'success',
             duration: 5000
           });
         }

         // Open document in a new tab
         if (document.download_url) {
           window.open(document.download_url, '_blank');
         } else {
           throw new Error('Document URL not available');
         }
       } catch (error) {
         console.error('Error viewing document:', error);
         ElNotification.error({
           title: 'Error',
           message: 'Failed to view document: ' + error.message
         });
       }
     },

         async deleteDocument(document) {
       try {
         await ElMessageBox.confirm('Are you sure you want to delete this document?', 'Confirm Delete', {
           confirmButtonText: 'Delete',
           cancelButtonText: 'Cancel',
           type: 'warning'
         });

         this.deletingDocument = document.id;
         
         // Delete from storage if file_path exists
         if (document.file_path) {
           await supabase.storage
             .from('task-files')
             .remove([document.file_path]);
         }

         // Delete from database
         const { error } = await supabase
           .from('task_documents')
           .delete()
           .eq('id', document.id);

         if (error) throw error;

         await this.loadEsignDocuments();
         
         ElNotification.success({
           title: 'Success',
           message: 'Document deleted successfully'
         });
       } catch (error) {
         if (error === 'cancel') return;
         
         console.error('Error deleting document:', error);
         ElNotification.error({
           title: 'Error',
           message: 'Failed to delete document: ' + error.message
         });
       } finally {
         this.deletingDocument = null;
       }
     },

    // 1. Add a method to fetch signatures for a document
    async fetchSignaturesForDocument(documentId) {
      const { data, error } = await supabase
        .from('task_signatures')
        .select('*')
        .eq('document_id', documentId);
      if (error) {
        console.error('Error fetching signatures:', error);
        return [];
      }
      return data;
    },

    async handleSignaturePositionsSet(positions) {
      // Called after user sets signature positions in the modal
      try {
        this.uploadingPdf = true;
        const file = this.pendingPdfFileObj;
        const { data: { user } } = await supabase.auth.getUser();
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `task_documents/${this.task.id}/${fileName}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('task-files')
          .upload(filePath, file);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage
          .from('task-files')
          .getPublicUrl(filePath);
        // Insert document record with signature positions in metadata
        const { data, error } = await supabase
          .from('task_documents')
          .insert([
            {
              task_id: this.task.id,
              name: file.name,
              original_filename: file.name,
              file_path: filePath,
              download_url: urlData.publicUrl,
              size: file.size,
              mime_type: file.type,
              requires_signature: true,
              signature_status: 'pending',
              created_by_user_id: user.id,
              metadata: { esign_positions: positions }
            }
          ])
          .select();
        if (error) throw error;
        this.uploadFileList = [];
        this.pendingPdfFile = null;
        this.pendingPdfFileName = '';
        this.pendingPdfFileObj = null;
        this.pendingSignaturePositions = [];
        this.showSignaturePositionModal = false;
        await this.loadEsignDocuments();
        ElNotification.success({
          title: 'Success',
          message: 'PDF uploaded successfully'
        });
      } catch (error) {
        console.error('Error uploading PDF:', error);
        ElNotification.error({
          title: 'Error',
          message: 'Failed to upload PDF: ' + error.message
        });
      } finally {
        this.uploadingPdf = false;
      }
    },

    showCreateTaskDialog() {
      this.createTaskDialogVisible = true;
      this.resetNewTask();
    },

    resetNewTask() {
      this.newTask = {
        title: '',
        description: '',
        status: 'not_started',
        priority: 'medium',
        due_date: null,
        assignee: null,
        parent_task_id: null
      };
      this.showMoreFields = false;
    },

    async createNewTask() {
      if (!this.currentWorkspace) {
        ElNotification.error({
          title: 'Error',
          message: 'Please select a workspace first'
        });
        return;
      }

      if (!this.newTask.title.trim()) {
        ElNotification.error({
          title: 'Error',
          message: 'Task title is required'
        });
        return;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        const taskData = {
          ...this.newTask,
          title: this.newTask.title.trim(),
          matter_id: this.currentWorkspace.id,
          created_by: user.id
        };

        const { data, error } = await supabase
          .from('tasks')
          .insert([taskData])
          .select();

        if (error) throw error;

        // Create notification if task is assigned to someone
        if (taskData.assignee && taskData.assignee !== user.id) {
          await this.createNotification(
            taskData.assignee,
            'task_assigned',
            { task_id: data[0].id, task_title: data[0].title }
          );
        }

        // Parse description for mentions and create notifications
        if (taskData.description) {
          const mentionRegex = /<span data-mention[^>]*data-id="([^"]+)"[^>]*>@([^<]+)<\/span>/g;
          const mentions = [...taskData.description.matchAll(mentionRegex)];
          
          for (const mention of mentions) {
            const userId = mention[1];
            if (userId && userId !== user.id) {
              await this.createNotification(
                userId,
                'mention',
                { 
                  task_id: data[0].id, 
                  task_title: data[0].title,
                  comment_by: user.email
                }
              );
            }
          }
        }

        // Log task creation activity
        await supabase
          .from('task_comments')
          .insert({
            task_id: data[0].id,
            user_id: user.id,
            content: 'Created this task',
            type: 'activity',
            matter_id: this.currentWorkspace.id,
            metadata: {
              action: 'create',
              task_title: data[0].title
            }
          });
        
        // Update cache
        const cachedTasks = this.taskStore.getCachedTasks(this.currentWorkspace.id) || [];
        const updatedTasks = [data[0], ...cachedTasks];
        this.taskStore.setCachedTasks(this.currentWorkspace.id, updatedTasks);
        
        // Update workspace activity
        await updateMatterActivity(this.currentWorkspace.id);

        // Send Telegram notification
        await sendTelegramNotification({
          workspaceId: this.currentWorkspace.id,
          activityType: 'TASK_CREATED',
          message: `New task created: "${data[0].title}"\nCreated by: ${user.email}`
        });

        this.createTaskDialogVisible = false;
        this.resetNewTask();
        
        ElNotification.success({
          title: 'Success',
          message: 'Task created successfully'
        });
      } catch (error) {
        console.error('Error creating task:', error);
        ElNotification.error({
          title: 'Error',
          message: 'Failed to create task: ' + error.message
        });
      }
    },

    showMoveToDialog() {
      this.moveToDialogVisible = true;
      this.loadAvailableWorkspaces();
      this.resetMoveToForm();
    },

    resetMoveToForm() {
      this.moveToForm = {
        targetWorkspaceId: null
      };
    },

    async loadAvailableWorkspaces() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Get workspaces the user has access to (excluding current workspace)
        const { data: accessData, error: accessError } = await supabase
          .from('workspace_access')
          .select('matter_id')
          .eq('shared_with_user_id', user.id);

        if (accessError) throw accessError;

        const accessibleWorkspaceIds = accessData?.map(row => row.matter_id) || [];

        // Get the workspaces
        const { data: workspaces, error } = await supabase
          .from('workspaces')
          .select('id, title')
          .eq('archived', false)
          .neq('id', this.currentWorkspace?.id) // Exclude current workspace
          .in('id', accessibleWorkspaceIds);

        if (error) throw error;
        
        this.availableWorkspaces = workspaces || [];
      } catch (error) {
        console.error('Error loading available workspaces:', error);
        ElNotification.error({
          title: 'Error',
          message: 'Failed to load available workspaces'
        });
      }
    },

    async moveTaskToWorkspace() {
      if (!this.moveToForm.targetWorkspaceId) {
        ElNotification.error({
          title: 'Error',
          message: 'Please select a workspace to move the task to'
        });
        return;
      }

      if (!this.task) {
        ElNotification.error({
          title: 'Error',
          message: 'No task selected to move'
        });
        return;
      }

      this.movingTask = true;

      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        // Start a transaction to move the task and all related data
        const { error: taskError } = await supabase
          .from('tasks')
          .update({ 
            matter_id: this.moveToForm.targetWorkspaceId,
            updated_at: new Date().toISOString()
          })
          .eq('id', this.task.id);

        if (taskError) throw taskError;

        try {
        // Update task comments if record exists
        const { data: comments, error: commentsError } = await supabase
          .from('task_comments')
          .select('id')
          .eq('task_id', this.task.id);

        if (commentsError) {
          console.error('Error moving task comments:', commentsError);
        } else {
          const { error: commentsError } = await supabase
          .from('task_comments')
          .update({ 
            matter_id: this.moveToForm.targetWorkspaceId,
            updated_at: new Date().toISOString()
          })
          .eq('task_id', this.task.id);
        }
                
       
          // Update task hours logs if record exists
          const { data: hoursLogs, error: hoursLogsError } = await supabase
            .from('task_hours_logs')
            .select('id')
            .eq('task_id', this.task.id);

          if (hoursLogsError) {
            console.error('Error moving task hours logs:', hoursLogsError);
          } else {
            const { error: hoursError } = await supabase
            .from('task_hours_logs')
            .update({ 
              matter_id: this.moveToForm.targetWorkspaceId,
              updated_at: new Date().toISOString()
            })
            .eq('task_id', this.task.id);
          }
        } catch (error) {
          console.error('Error moving task hours logs:', error);
        }

        // Clear task cache for both source and target workspaces
        this.taskStore.clearTaskCache(this.currentWorkspace.id);
        this.taskStore.clearTaskCache(this.moveToForm.targetWorkspaceId);
        this.taskStore.clearTaskDetailCache(this.task.id);

        /*
        // Log the move activity
        await supabase
          .from('task_comments')
          .insert({
            task_id: this.task.id,
            user_id: user.id,
            content: `Moved this task to workspace: ${this.availableWorkspaces.find(w => w.id === this.moveToForm.targetWorkspaceId)?.title || 'Unknown'}`,
            type: 'activity',
            matter_id: this.moveToForm.targetWorkspaceId,
            metadata: {
              action: 'move',
              from_workspace_id: this.currentWorkspace.id,
              to_workspace_id: this.moveToForm.targetWorkspaceId,
              from_workspace_title: this.currentWorkspace.title,
              to_workspace_title: this.availableWorkspaces.find(w => w.id === this.moveToForm.targetWorkspaceId)?.title || 'Unknown'
            }
          });
          */

        // Update workspace activity for both workspaces
        await Promise.all([
          updateMatterActivity(this.currentWorkspace.id),
          updateMatterActivity(this.moveToForm.targetWorkspaceId)
        ]);

        ElNotification.success({
          title: 'Success',
          message: 'Task moved successfully to the selected workspace'
        });

        const targetWorkspace = this.availableWorkspaces.find(w => w.id === this.moveToForm.targetWorkspaceId);
        // Close dialog and reset form
        this.moveToDialogVisible = false;
        this.resetMoveToForm();

        // Navigate to the new workspace's task list
        this.$router.push(`/single-workspace/${targetWorkspace.id}/tasks`);

      } catch (error) {
        console.error('Error moving task:', error);
        ElNotification.error({
          title: 'Error',
          message: 'Failed to move task: ' + error.message
        });
      } finally {
        this.movingTask = false;
      }
    },

  },
  watch: {
    shareDialogVisible(newVal) {
      if (newVal) {
        this.generateShareLink();
        this.handleLoadExternalShareHistory();
      }
    },
    'task.title': {
      immediate: true,
      handler(newTitle) {
        this.updatePageTitle();
      }
    },
    currentWorkspace: {
      handler() {
        this.updatePageTitle();
      }
    },
    '$route.params.taskId': {
      immediate: true,
      async handler(newTaskId, oldTaskId) {
        if (newTaskId && newTaskId !== oldTaskId) {
          // Refresh cache when navigating to a different task
          await this.refreshTaskCache();
          await this.loadTask(newTaskId);
        }
      }
    },
    createChildTaskDialogVisible(newVal) {
      if (!newVal) {
        this.resetChildTaskForm();
      }
    },
    createTaskDialogVisible(newVal) {
      if (newVal) {
        this.resetNewTask();
      }
    }
  },
  computed: { 
    displayedHoursLogs() {
    return this.showAllLogs ? this.hoursLogs : this.hoursLogs.slice(0, 3);
  },
  hasActiveShare() {
    return this.externalShareHistory.some(share => share.status === 'active');
  },
    isTaskStarred() {
    return this.task?.task_stars?.some(star => star.user_id === this.currentUser?.id) || false;
  },
  starredByText() {
    if (!this.task?.task_stars?.length) return '';
    
    const starredUsers = this.task.task_stars.map(star => {
      return this.userEmails[star.user_id] || 'Unknown user';
    });

    if (starredUsers.length === 1) {
      return `Starred by ${starredUsers[0]}`;
    } else if (starredUsers.length === 2) {
      return `Starred by ${starredUsers.join(' and ')}`;
    } else {
      const othersCount = starredUsers.length - 2;
      return `Starred by ${starredUsers[0]}, ${starredUsers[1]} and ${othersCount} other${othersCount > 1 ? 's' : ''}`;
    }
  },
    filteredFiles() {
      const items = [...this.folders, ...this.files];
      if (!this.fileSearchQuery) return items;
      const query = this.fileSearchQuery.toLowerCase();
      return items.filter(item => 
        item.name.toLowerCase().includes(query)
      );
    },
    totalHours() {
      return this.hoursLogs.reduce((sum, log) => sum + (log.hours || 0), 0).toFixed(2);
    },
    formatTotalTime() {
      const totalMinutes = this.hoursLogs.reduce((sum, log) => {
        if (!log.time_taken) return sum;
        const [hours, minutes] = log.time_taken.split(':').map(Number);
        return sum + (hours * 60) + minutes;
      }, 0);

      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  },
    canEditTask() {
      if (!this.currentWorkspace || !this.currentUser) return false;
      const userAccess = this.sharedUsers.find(u => u.id === this.currentUser.id);
      return userAccess?.access_type === 'edit';
    },
    
    flattenedTasks() {
      const flattened = [{
        id: '',
        title: '- no parent -'
      }];
      
      const flatten = (tasks, depth = 0) => {
        const taskMap = new Map(tasks.map(task => [task.id, task]));
        
        // Get all invalid task IDs (current task and its hierarchy)
        const invalidTaskIds = new Set([
          this.task?.id,
          ...this.getPredecessorIds(this.task?.id, taskMap),
          ...this.getDescendantIds(this.task?.id, taskMap)
        ]);

        for (const task of tasks) {
          if (!invalidTaskIds.has(task.id)) {
            flattened.push({
              id: task.id || '',
              title: '  '.repeat(depth) + task.title
            });
            if (task.children?.length) {
              flatten(task.children, depth + 1);
            }
          }
        }
      };
      
      // Get tasks from task store
      const tasks = this.taskStore.getCachedTasks(this.currentWorkspace?.id) || [];
      const organizedTasks = this.organizeTasksHierarchy(tasks);
      flatten(organizedTasks);
      
      return flattened;
    },
    sortedSharedUsers() {
      return this.sharedUsers.sort((a, b) => a.email.localeCompare(b.email));
    },
    filteredComments() {
      return this.comments.filter(comment => {
        // Handle archived comments
        if (!this.showArchivedComments && comment.archived) {
          return false;
        }
        
        // Handle system comments
        if (!this.showSystemComments && comment.type === 'activity') {
          return false;
        }
        
        return true;
      });
    },
    statusTypeClass() {
      return `status-${this.getStatusType({ status: this.task?.status })}`;
    },
    priorityBackgroundClass() {
      switch (this.task?.priority?.toLowerCase()) {
        case 'high':
          return 'bg-danger';
        case 'medium':
          return 'bg-warning';
        case 'low':
          return 'bg-info';
        default:
          return '';
      }
    },
    statusBackgroundClass() {
      switch (this.task?.status?.toLowerCase()) {
        case 'completed':
          return 'bg-success';
        case 'in_progress':
          return 'bg-warning'; // Changed from bg-primary to bg-warning to match dropdown
        case 'not_started':
          return 'bg-info';
        case 'blocked':
          return 'bg-danger';
        default:
          return '';
      }
    },
    childTasks() {
      const tasks = this.taskStore.getCachedTasks(this.currentWorkspace?.id) || [];
      
      // Helper function to recursively find all descendant tasks
      const findDescendants = (taskId) => {
        const directChildren = tasks.filter(task => task.parent_task_id === taskId);
        const descendants = [...directChildren];
        
        directChildren.forEach(child => {
          descendants.push(...findDescendants(child.id));
        });
        
        return descendants;
      };
      
      return findDescendants(this.task.id);
    },

    sortedChildTasks() {
      // First filter out completed tasks if the setting is disabled
      let filteredTasks = this.showCompletedTasks 
        ? [...this.childTasks] 
        : this.childTasks.filter(task => task.status !== 'completed');
      
      return filteredTasks.sort((a, b) => {
        let aValue, bValue;
        
        switch (this.sortColumn) {
          case 'title':
            aValue = a.title || '';
            bValue = b.title || '';
            break;
            
          case 'status':
            // Define a custom order for status
            const statusOrder = { 
              'not_started': 1, 
              'in_progress': 2, 
              'awaiting_external': 3, 
              'awaiting_internal': 4, 
              'completed': 5 
            };
            aValue = statusOrder[a.status] || 0;
            bValue = statusOrder[b.status] || 0;
            break;
            
          case 'priority':
            const priorityOrder = { high: 3, medium: 2, low: 1, '': 0, null: 0, undefined: 0 };
            aValue = priorityOrder[a.priority] || 0;
            bValue = priorityOrder[b.priority] || 0;
            break;
            
          default:
            aValue = a.title || '';
            bValue = b.title || '';
        }
        
        // Handle different data types
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          const comparison = aValue.localeCompare(bValue);
          return this.sortDirection === 'asc' ? comparison : -comparison;
        } else {
          // Numeric comparison
          const comparison = aValue - bValue;
          return this.sortDirection === 'asc' ? comparison : -comparison;
        }
      });
    },

    sortedSharedUsers() {
      return [...this.sharedUsers].sort((a, b) => 
        a.email.localeCompare(b.email)
      );
    }
  }
};
</script>

<style scoped>

.status-item, .priority-item, .due-date-item{
  width: 100px;
}

.description-wrapper {
  margin-top: 24px;
  background: var(--el-bg-color);
  border-radius: 8px;
  padding: 16px;
  border: 1px solid var(--el-border-color-light);
}

.description-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.description-header h3 {
  margin: 0;
  color: #303133;
  font-size: 18px;
  text-decoration: underline;
}

.description-wrapper > p.description {
  position: relative;
  padding-left: 16px;
  border-left: 3px solid var(--el-color-primary-light-5);
  padding: 12px 16px;
  border-radius: 4px;
  margin: 0;
  font-size: 15px;
  white-space: pre-wrap;
  word-wrap: break-word;
  word-break: break-word;
  overflow-wrap: break-word;
  max-width: 100%;
}

/* Add mobile-specific adjustments */
@media (max-width: 768px) {
  .description {
    padding: 8px 4px;         /* Reduce padding on mobile */
    font-size: 14px;          /* Slightly smaller font on mobile */
  }
}

.description:hover {
  background-color: var(--el-bg-color);
}

.description-edit {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.description-edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.title-wrapper {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.star-container {
  display: inline-flex;
  align-items: center;
  padding-top: 4px; /* Align with title text */
}

.title-edit-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px;
  min-width: 0;
}

.editable-title {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  margin: 0;
}

.editable-title:hover {
  background-color: var(--el-bg-color);
}

.editable-title .edit-icon {
  opacity: 0;
  transition: opacity 0.3s;
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.editable-title:hover .edit-icon {
  opacity: 1;
}

.title-edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.task-metadata {
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  padding: 1rem;
  width: 100%;
  box-sizing: border-box;
  overflow: hidden;
}

.metadata-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  width: 100%;
  margin: 1rem 0;
}

.metadata-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 0;
}

.metadata-label {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.label-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-content {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 24px; /* To align with the icon */
}

.status-label {
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.status-display {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-text {
  font-size: 14px;
  white-space: nowrap;
}

.status-text.status-success {
  color: var(--el-color-success);
}

.status-text.status-primary {
  color: var(--el-color-primary);
}

.status-text.status-info {
  color: var(--el-color-info);
}

.status-text.status-warning {
  color: var(--el-color-warning);
}

.spacer {
  width: 8px; /* Fixed space after "Status" */
  flex: none;
}

/* Mobile adjustments */
@media (max-width: 768px) {
  .status-content {
    justify-content: flex-start; /* Align content to start on mobile */
  }
}

.edit-icon {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s;
}

/* Show edit icon on mobile */
@media (max-width: 768px) {
  .edit-icon {
    opacity: 1;
  }
}

/* Show edit icon on hover for desktop */
.status-display:hover .edit-icon {
  opacity: 1;
}

.metadata-label .el-icon {
  font-size: 16px;
}

.status-tag,
.priority-tag,
.due-date-display,
.assignee-display {
  width: 100%;
  min-width: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  overflow: hidden; /* Add this to prevent overflow */
}

.due-date-display,
.assignee-display {
  padding: 5px 3px;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  transition: all 0.3s;
}

.due-date-display:hover,
.assignee-display:hover {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}

.assignee-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-option {
  display: flex;
  align-items: center;
  gap: 8px;
}
.document-details {
    display: flex;
    gap: 2rem;
}
@media (max-width: 768px) {
  .metadata-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .metadata-item {
    display: flex;
    width: 100%;
    padding: 8px 0;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  .metadata-label {
    display: flex;
    flex-direction: row;
    width: 100%;
  }

  .label-header {
    width: 100px; /* Fixed width for labels */
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .status-content {
    flex: 1;
    padding-left: 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .status-display {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .status-text {
    flex: 1;
  }

  .edit-icon {
    opacity: 1;
    margin-left: 8px;
  }
}

/* Tablet and desktop styles */
@media (min-width: 769px) {
  .metadata-grid {
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  }
}

.due-date-display {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 3px;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s;
  color: var(--el-text-color-secondary);
}

.due-date-display:hover {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}

.due-date-editor {
  padding: 8px;
}

.due-date-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16px;
  gap: 8px;
}

:deep(.el-popover.due-date-popover) {
  padding: 16px;
}
.assignee-display {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 3px 6px;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s;
}

.assignee-display:hover {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}

.assignee-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

.assignee-select {
  width: 100%;
}

.assignee-select :deep(.el-select__wrapper) {
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  transition: all 0.3s;
}

.assignee-select :deep(.el-select__wrapper:hover) {
  border-color: var(--el-color-primary);
}

.assignee-select :deep(.el-option .user-option) {
  width: 100%;
  padding: 4px 0;
}

:deep(.el-dropdown-menu__item) {
  display: flex;
  align-items: center;
  gap: 8px;
}

:deep(.el-avatar) {
  background-color: var(--el-color-primary);
  color: white;
  font-size: 12px;
}
.hours-logs {
  margin-top: 24px;
  background: #fff;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
}

.hours-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.hours-header h3 {
  margin: 0;
  color: #303133;
  font-size: 18px;
  text-decoration: underline;
}

.total-hours .el-tag {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
}

.total-time {
  font-size: 15px;
  font-weight: 500;
}

.hours-table {
  border-radius: 8px;
  overflow: hidden;
}

.time-wrapper,
.user-wrapper,
.date-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.time-cell {
  font-family: 'Roboto Mono', monospace;
  font-size: 14px;
  /* color: #409EFF; */
  font-weight: 500;
}

.comment-cell {
  padding: 8px 0;
  color: #606266;
  line-height: 1.5;
}

.no-comment {
  color: #909399;
  font-style: italic;
}

.user-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-avatar {
  background: #409EFF;
  font-size: 12px;
}

.user-cell {
  color: #606266;
  font-weight: 500;
}

.date-wrapper {
  /* display: flex; */
  /* flex-direction: column; */
  align-items: center;
}

.date-cell {
  color: #606266;
  font-weight: 500;
}

.time-stamp {
  color: #909399;
  font-size: 12px;
  margin-top: 2px;
}

:deep(.el-table) {
  --el-table-border-color: #EBEEF5;
  --el-table-header-bg-color: #F5F7FA;
  --el-table-row-hover-bg-color: #F5F7FA;
}

:deep(.el-table th) {
  font-weight: 600;
  color: #303133;
  background: var(--el-table-header-bg-color);
  padding: 12px 0;
}

:deep(.el-table td) {
  padding: 1px 0;
}

:deep(.hours-table-row:hover) td {
  background-color: #F5F7FA !important;
}

:deep(.el-table--striped .el-table__body tr.el-table__row--striped td) {
  background: #FAFAFA;
}

.priority-tag {
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  margin-right: 12px;
}

.priority-tag:hover {
  opacity: 0.8;
}

.star-icon {
  cursor: pointer;
  font-size: 18px;
  color: #909399;
  transition: color 0.3s;
}
.star-icon.starred {
  color: #f0c541;
  font-size: 18px;
}

.star-button {
  margin-right: 4px;
}

.star-button :deep(.el-icon) {
  font-size: 16px;
}

.star-count {
  font-size: 14px;
  color: #606266;
  cursor: default;
}
.single-task-view {
  padding: 0 20px 20px 20px;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--el-color-primary);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  padding: 8px 12px;
  border-radius: 4px;
  transition: all 0.3s;
  cursor: pointer;
}

.back-link:hover {
  background-color: var(--el-color-primary-light-9);
  color: var(--el-color-primary-dark-2);
}

.back-link:active {
  transform: translateY(1px);
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.task-content {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.task-main-info {
  background: white;
  padding: 24px;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
}

.task-metadata {
  display: flex;
  gap: 16px;
  align-items: center;
  margin: 16px 0;
}

.description {
  margin-top: 16px;
  color: #606266;
}

.task-comments {
  background: white;
  padding: 24px;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
}

.comments-list {
  margin: 20px 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Reuse comment styles from QuickTaskViewCt.vue */
/* Lines 209-256 */

.header-actions {
  display: flex;
  gap: 4px; /* Reduced from 8px to 4px */
}

.share-options {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.share-link-section,
.share-email-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

h4 {
  margin: 0;
  color: #606266;
}

.link-input {
  display: flex;
  gap: 12px;
}

.comment-item {
  margin-bottom: 1rem;
}

.comment-content {
  background-color: #f5f7fa;
  padding: 12px;
  border-radius: 8px;
}

.comment-content.activity {
  background-color: #f0f9ff;
  font-style: italic;
  font-size: 0.95em;
}

.comment-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 0.9em;
}

.comment-author-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

.comment-author {
  font-weight: 500;
  color: #409EFF;
}

.external-tag {
  margin-left: 4px;
}

.comment-date {
  color: #909399;
}

.comment-text {
  color: #606266;
  white-space: normal;
}

.comment-text :deep(a.file-link) {
  color: #409EFF;
  text-decoration: none;
}

.comment-text :deep(a.file-link:hover) {
  text-decoration: underline;
}

.comment-text:deep(a) {
  color: #409EFF;
  text-decoration: none;
}

.description:deep(a) {
  color: #409EFF;
  text-decoration: none;
}
.description-edit:deep(a) {
  color: #409EFF;
  text-decoration: none;
}


.comments-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

/* Add responsive styles for comments */
@media (max-width: 640px) {
  .task-comments {
    padding: 16px;
  }
  
  .comment-content {
    padding: 10px;
  }
}

.file-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.file-item {
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.file-item:hover {
  background-color: #f5f7fa;
}

.edit-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 8px;
}

.typeahead-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid #dcdfe6;
  background-color: #f5f7fa;
}

.typeahead-header span {
  color: #909399;
  font-size: 0.9em;
}

.close-button {
  padding: 2px;
}

.close-button:hover {
  color: #409EFF;
}

.comment-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.comment-actions .el-dropdown {
  margin-left: 4px;
}

.comment-actions .el-button {
  padding: 4px;
  height: auto;
}

.comment-actions .el-icon {
  font-size: 16px;
  color: #909399;
}

.edited-marker {
  font-size: 0.9em;
  color: #909399;
  cursor: pointer;
}

.edited-marker:hover {
  text-decoration: underline;
}

.edit-history {
  margin-top: 8px;
  padding: 8px;
  background: #f9f9f9;
  border-radius: 4px;
}

.edit-history-entry {
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #eee;
}

.edit-history-entry:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.edit-history-header {
  font-weight: 500;
  margin-bottom: 8px;
  color: #606266;
}

.previous-content {
  background: #f5f7fa;
  padding: 8px;
  border-radius: 4px;
  margin-bottom: 8px;
  white-space: pre-wrap;
}

.edit-metadata {
  font-size: 0.8em;
  color: #909399;
}

.task-title-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
}

.title-main-section {
  flex: 1;
  min-width: 0;
}

.title-wrapper {
  flex: 1;
  min-width: 0;
}

.editable-title {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  margin: 0;
  min-width: 0;
}

.star-container {
  display: inline-flex;  /* Change from flex to inline-flex */
  align-items: center;
  margin-right: -4px;  /* Add negative margin to reduce space */
}

.star-icon {
  cursor: pointer;
  font-size: 16px;  /* Reduce from 18px to 16px */
  color: #909399;
  transition: color 0.3s;
  padding: 4px;  /* Add padding for better click target while maintaining visual compactness */
}

.star-icon.starred {
  color: #f0c541;
}

.edit-metadata {
  display: flex;
  align-items: center;
  white-space: nowrap;
  margin-left: auto;
}

.edited-marker {
  font-size: 0.9em;
  color: #909399;
  cursor: pointer;
}

.edited-marker:hover {
  text-decoration: underline;
}

/* Responsive adjustments */
@media (max-width: 640px) {
  .task-title-header {
    flex-direction: column;
  }
  
  .edit-metadata {
    align-self: flex-end;
  }
}

.status-display {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-text {
  font-size: 14px;
  white-space: nowrap;
}

.status-text.status-success {
  color: var(--el-color-success);
}

.status-text.status-primary {
  color: var(--el-color-primary);
}

.status-text.status-info {
  color: var(--el-color-info);
}

.status-text.status-warning {
  color: var(--el-color-warning);
}

.edit-icon {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s;
}

/* Show edit icon on mobile */
@media (max-width: 768px) {
  .edit-icon {
    opacity: 1;
  }
}

/* Show edit icon on hover for desktop */
.status-display:hover .edit-icon {
  opacity: 1;
}

.log-hours-btn,
.share-task-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0; /* Explicitly remove any margins */
  padding: 8px 12px; /* Consistent padding */
}

@media (max-width: 768px) {
  .log-hours-btn .log-hours-text,
  .share-task-btn .share-task-text {
    display: none;
  }
  
  .log-hours-btn,
  .share-task-btn {
    padding: 8px;
    min-height: 32px;
    min-width: 32px;
    margin: 0;
  }
}

.share-task-btn {
  display: flex;
  align-items: center;
  gap: 6px;
}

@media (max-width: 768px) {
  .share-task-btn .share-task-text {
    display: none;
  }
  
  .share-task-btn {
    padding: 8px;
    min-height: 32px;
    min-width: 32px;
  }
}
</style> 

<style>
table.editor-table {
  border-collapse: collapse;
  margin: 1.5em 0;
  width: 100%;
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
  border: 1px solid var(--el-border-color);

  th, td {
    padding: 12px 16px;
    text-align: left;
    border: 1px solid var(--el-border-color-lighter);
    line-height: 1.5;
    font-size: 14px;

    &:first-child {
      padding-left: 16px;
    }

    &:last-child {
      padding-right: 16px;
    }
  }

  th {
    background: var(--el-fill-color-light);
    font-weight: 600;
    color: var(--el-text-color-primary);
    white-space: nowrap;
  }

  tr {
    &:nth-child(even) {
      background-color: var(--el-fill-color-lighter);
    }

    &:hover {
      background-color: var(--el-fill-color-light);
    }
  }

  @media (max-width: 640px) {
    font-size: 13px;
    
    th, td {
      padding: 8px;
    }
  }
}
.ai-response {
  background-color: var(--el-color-success-light-9);
  border-left: 3px solid var(--el-color-success);
}

.ai-response .comment-author {
  color: var(--el-color-success);
  font-weight: 600;
}
</style>

<style scoped>
.loading-state {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}
</style>

<style scoped>
.description-wrapper {
  margin-top: 24px;
  background: var(--el-bg-color);
  border-radius: 8px;
  padding: 16px;
  border: 1px solid var(--el-border-color-light);
}

.description-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.description {
  cursor: pointer;
  padding: 8px;
  border-radius: 4px;
  transition: background-color 0.3s;
  margin: 0;
  font-size: 15px;
}

.description:hover {
  background-color: var(--el-bg-color);
}

.description-edit {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.description-edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>

<style scoped>
.task-content-wrapper {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

/*.task-main-content {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  padding: 2rem;
  width: 100%;
  box-sizing: border-box;
  overflow: hidden;
}*/

.task-tabs-section {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  padding: 1rem;
}

.task-tabs {
  width: 100%;
}

.tab-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
}

.tab-badge {
  margin-left: 4px;
}

.tab-content {
  padding: 1rem 0;
}

.comments-header {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-bottom: 1rem;
}



@media (max-width: 768px) {
  .task-content-wrapper {
    width: 100%;
    padding: 0;
    margin: 0;
  }

  /*.task-main-content {
    width: 100%;
    padding: 1rem;
    border-radius: 0;
    box-shadow: none;
  }*/

  .task-main-info {
    padding: 12px; /* Reduced from 24px to 12px */
  }

  .task-metadata {
    width: 100%;
    border-radius: 0;
    border-left: 0;
    border-right: 0;
    margin: 0; /* Remove top and bottom margin */
  }

  .metadata-grid {
    width: 100%;
    gap: 0.5rem;
    padding: 0;
    margin: 0.5rem 0; /* Reduced margin from 1rem to 0.5rem */
  }

  .metadata-item {
    width: 100%;
  }

  .task-tabs-section {
    border-radius: 0;
    box-shadow: none;
    padding: 0.5rem;
  }
  
  .tab-content {
    padding: 0.5rem 0;
  }
  
  .tab-label {
    font-size: 13px;
  }
  
  .tab-badge {
    margin-left: 2px;
  }

  /* Make dialog take up most of the screen width on mobile */
  :deep(.el-dialog) {
    width: 90% !important;
    margin: 5vh auto !important;
  }

  /* Adjust time input container for mobile */
  .time-input-container {
    .time-input-group-container {
      flex-direction: column;
      gap: 8px;
    }

    .time-input-group {
      width: 100%;
      justify-content: center;
    }

    .time-unit {
      align-self: center;
    }

    .time-input-help {
      text-align: center;
      margin-top: 8px;
    }
  }

  /* Make dialog footer buttons stack on mobile */
  :deep(.dialog-footer) {
    display: flex;
    flex-direction: column;
    gap: 8px;
    
    .el-button {
      width: 100%;
      margin-left: 0 !important;
    }
  }
}
</style>

<style scoped>
.task-parent {
  margin-top: 16px;
  background: var(--el-bg-color);
  border-radius: 8px;
  padding: 16px;
  border: 1px solid var(--el-border-color-light);
}

.task-parent h4 {
  margin: 0;
  color: #606266;
}

.task-parent .el-select {
  width: 100%;
}
</style>

<style scoped>
/* Add to your existing styles */
.task-parent {
  margin: 1rem 0;
  padding: 1rem;
  background-color: var(--el-bg-color);
  border-radius: 8px;
}

.task-parent h4 {
  margin: 0 0 0.5rem 0;
  font-size: 1rem;
  color: var(--el-text-color-primary);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.task-parent :deep(.el-select) {
  width: 100%;
}

.task-parent :deep(.el-select.is-disabled .el-input) {
  opacity: 0.7;
}
</style>

<style scoped>
.comment-edit-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 8px;
}

.comment-text {
  margin-top: 8px;
}
</style>

<style scoped>
/* Add to existing styles */
/*.comments-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}*/

.comment-item.archived {
  opacity: 0.7;
  background-color: #f5f7fa;
}
</style>

<style scoped>
.comment-action-buttons {
  display: flex;
  gap: 8px;
}

.comment-action-buttons .el-button {
  font-size: 12px;
  color: #909399;
  padding: 4px 8px;
  height: auto;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.comment-action-buttons .el-button .el-icon {
  font-size: 14px;
  margin-right: 2px;
}

.comment-action-buttons .el-button:hover {
  color: var(--el-color-primary);
  background: transparent;
}

.comment-action-buttons .el-button + .el-button {
  margin-left: 0;
}
</style>

<style scoped>
/* Update these styles */
.el-dropdown-menu__item {
  font-size: 10px !important;
  color: #909399 !important;
  padding: 6px 12px !important;
  height: 28px !important;
  line-height: 16px !important;
}

.el-dropdown-menu__item:hover {
  color: #409EFF !important;
  background-color: #f5f7fa !important;
}

/* Make the icon inside dropdown items smaller */
.el-dropdown-menu__item .el-icon {
  font-size: 10px;
  margin-right: 4px;
}

/* Make the dropdown button more compact */
.comment-actions .el-button.el-button--default {
  padding: 4px !important;
  height: 24px !important;
  width: 24px !important;
}

.comment-actions .el-button .el-icon {
  font-size: 14px;
}
</style>

<style scoped>
.comment-history {
  margin-top: 12px;
  padding: 12px;
  background: var(--el-bg-color-page);
  border-radius: 4px;
  border: 1px solid var(--el-border-color-lighter);
}

.history-header {
  font-weight: 500;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
  font-size: 0.9em;
}

.history-entry {
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.history-entry:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.previous-content {
  background: var(--el-fill-color-lighter);
  padding: 8px;
  border-radius: 4px;
  margin-bottom: 4px;
  white-space: pre-wrap;
  font-size: 0.95em;
}

.edit-metadata {
  font-size: 0.8em;
  color: var(--el-text-color-secondary);
}
</style>

<style scoped>
.comments-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.control-label {
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.divider {
  color: var(--el-border-color);
  margin: 0 8px;
}
</style>

<style scoped>
.dropdown-item-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 8px;
}

:deep(.el-dropdown-menu__item:focus),
:deep(.el-dropdown-menu__item:not(.is-disabled):hover) {
  background-color: transparent;
}

:deep(.el-dropdown-menu__item) {
  padding: 8px 12px;
}
</style>

<style scoped>
.system-comments-label,
.archived-comments-label {
  font-size: 0.95em;
  cursor: pointer;
}

.dropdown-item-content {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>

<style>
.mobile-edit-dialog {
  margin: 20px;
}

@media (max-width: 768px) {
  .mobile-edit-dialog {
    width: 90% !important;
    margin: 10px auto;
  }
}
</style>

<style scoped>
.metadata-popover {
  padding: 12px !important;
}

.metadata-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.metadata-option {
  padding: 8px;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.2s;
  width: 100%;
}

.metadata-option:hover {
  background-color: var(--el-fill-color-light);
}

.metadata-option.selected {
  background-color: var(--el-fill-color);
}

.user-option {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  overflow: hidden;
}

.user-option span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Ensure popovers appear in correct position and styling on mobile */
@media (max-width: 768px) {
  :deep(.el-popper.metadata-popover) {
    position: fixed !important;
    margin-top: 4px !important;
    width: calc(100% - 32px) !important;
    max-width: 300px;
  }
  
  .user-option {
    font-size: 14px;
  }
}
</style>

<style scoped>

</style>

<style scoped>
.description-wrapper > p.description {
  position: relative;
  padding-left: 16px;
}

.description-wrapper > p.description::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background-color: var(--el-color-primary-light-5);
  border-radius: 2px;
}
</style>

<style scoped>
.text-danger {
  color: var(--el-color-danger);
}

.text-warning {
  color: var(--el-color-warning);
}

.text-info {
  color: var(--el-color-info);
}

/* Make the text slightly bolder for better visibility */
.status-text {
  font-weight: 500;
}
</style>

<style scoped>
.status-display {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.bg-danger {
  background-color: var(--el-color-danger-light-9);
}

.bg-warning {
  background-color: var(--el-color-warning-light-9);
}

.bg-info {
  background-color: var(--el-color-info-light-9);
}

/* Remove the text color classes since we're using background now */
.status-text {
  font-weight: 500;
}
</style>

<style scoped>
.bg-success {
  background-color: var(--el-color-success-light-9);
}

.bg-primary {
  background-color: var(--el-color-primary-light-9);
}

.bg-danger {
  background-color: var(--el-color-danger-light-9);
}
</style>

<style scoped>
.task-children {
  margin-top: 16px;
  background: var(--el-bg-color);
  border-radius: 8px;
  padding: 16px;
  border: 1px solid var(--el-border-color-light);
}

.task-children h4 {
  margin-bottom: 12px;
  color: #606266;
}

.child-tasks-table {
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  overflow: hidden;
}

.child-tasks-header {
  display: grid;
  grid-template-columns: 1fr 150px 120px;
  background: var(--el-fill-color-light);
  border-bottom: 1px solid var(--el-border-color-light);
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.child-tasks-header > div {
  padding: 12px 16px;
  font-size: 14px;
}

.child-task-row {
  display: grid;
  grid-template-columns: 1fr 150px 120px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  transition: background-color 0.2s;
}

.child-task-row:last-child {
  border-bottom: none;
}

.child-task-row:hover {
  background-color: var(--el-fill-color-lighter);
}

.child-task-row.updating {
  opacity: 0.6;
  pointer-events: none;
  position: relative;
}

.child-task-row.updating::after {
  content: '';
  position: absolute;
  top: 50%;
  right: 16px;
  width: 16px;
  height: 16px;
  border: 2px solid var(--el-color-primary);
  border-top: 2px solid transparent;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.status-display.updating {
  opacity: 0.7;
  pointer-events: none;
}

.loading-icon {
  font-size: 14px;
  color: var(--el-color-primary);
  animation: spin 1s linear infinite;
}

/* Inline loading messages */
.loading-message,
.adding-comment-message,
.creating-child-task-message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background-color: var(--el-fill-color-lighter);
  border-radius: 6px;
  color: var(--el-text-color-secondary);
  font-size: 14px;
  margin: 8px 0;
}

.section-loading {
  margin: 16px 0;
  padding: 16px;
  background-color: var(--el-bg-color);
  border-radius: 8px;
  border: 1px solid var(--el-border-color-light);
}

.section-loading-header {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.loading-spinner {
  font-size: 16px;
  color: var(--el-color-primary);
  animation: spin 1s linear infinite;
}

.comment-input-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
}

.adding-comment-message {
  align-self: flex-start;
  margin: 0;
  padding: 8px 12px;
  font-size: 13px;
}

.updating-assignee-message {
  margin-top: 8px;
  padding: 6px 10px;
  font-size: 12px;
}

.child-task-row > div {
  padding: 12px 16px;
  display: flex;
  align-items: center;
}

.column-description {
  min-width: 0; /* Allow text to wrap/truncate */
}

.column-status,
.column-priority {
  justify-content: flex-start;
}

.child-task-title {
  cursor: pointer;
  color: #409EFF;
  text-decoration: none;
  transition: color 0.2s;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.child-task-title:hover {
  text-decoration: underline;
  color: var(--el-color-primary-dark-2);
}

/* Mobile responsive */
@media (max-width: 768px) {
  .child-tasks-header,
  .child-task-row {
    grid-template-columns: 1fr 100px 80px;
  }
  
  .child-tasks-header > div,
  .child-task-row > div {
    padding: 8px 12px;
    font-size: 13px;
  }
  
  .child-task-title {
    font-size: 13px;
  }
}
</style>

<style scoped>
.parent-task-selector {
  display: flex;
  align-items: center;
  gap: 8px;
}

.view-parent-btn {
  flex-shrink: 0;
  padding: 8px;
}

.view-parent-btn .el-icon {
  font-size: 16px;
}



.child-tasks-header-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.child-tasks-header-section h4 {
  margin: 0;
}

.create-child-btn {
  display: flex;
  align-items: center;
  gap: 6px;
}

.no-child-tasks {
  text-align: center;
  padding: 2rem;
  color: var(--el-text-color-secondary);
  font-style: italic;
}

.no-child-tasks p {
  margin: 0;
}

.create-child-task-dialog .child-task-metadata {
  margin-top: 1rem;
}

.create-child-task-dialog .metadata-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1rem;
}

.create-child-task-dialog .metadata-field {
  margin-bottom: 0;
}

@media (max-width: 768px) {
  .child-tasks-header-section {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }
  
  .create-child-btn {
    width: 100%;
    justify-content: center;
  }
  
  .create-child-task-dialog .metadata-row {
    grid-template-columns: 1fr;
    gap: 0;
  }
  
  .create-child-task-dialog {
    width: 90% !important;
    margin: 5vh auto !important;
  }
}

.clickable-tag {
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.clickable-tag:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.sortable-column {
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s, color 0.2s;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.sortable-column:hover {
  background-color: var(--el-fill-color-light);
  color: var(--el-color-primary);
}

.sortable-column.active {
  color: var(--el-color-primary);
  font-weight: 600;
}

.column-title {
  flex: 1;
}

.column-controls {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.sort-icon {
  font-size: 14px;
  color: var(--el-color-primary);
  flex-shrink: 0;
}

.status-settings-icon {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  padding: 2px;
  transition: color 0.2s;
}

.status-settings-icon:hover {
  color: var(--el-color-primary);
}

.status-settings {
  padding: 8px;
}

.status-setting-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Ensure the sort icon doesn't interfere with mobile layout */
@media (max-width: 768px) {
  .sortable-column {
    font-size: 13px;
  }
  
  .sort-icon,
  .status-settings-icon {
    font-size: 12px;
  }
  }
</style>

<style scoped>
/* External Share Styles */
.share-task-dialog .el-tabs__content {
  padding: 20px;
}

.external-share-options .external-share-info {
  margin-bottom: 20px;
}

.external-link-section {
  margin-bottom: 30px;
}

.external-link-section h4 {
  margin-bottom: 15px;
  color: #2c3e50;
  font-weight: 600;
}

.external-link-controls {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
  flex-wrap: wrap;
}

.external-link-display {
  margin-top: 15px;
}

.external-link-info {
  margin-top: 10px;
}

.external-link-info .el-text {
  display: flex;
  align-items: center;
  gap: 5px;
}

.external-share-history h4 {
  margin-bottom: 15px;
  color: #2c3e50;
  font-weight: 600;
}

.external-share-history .el-table {
  font-size: 14px;
}

.share-history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.share-history-header h4 {
  margin: 0;
}

@media (max-width: 768px) {
  .external-link-controls {
    flex-direction: column;
  }
  
  .external-link-controls .el-button {
    width: 100%;
  }
  
  .share-history-header {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }
  
  .share-history-header .el-button {
    width: 100%;
  }
  
  .action-buttons {
    flex-direction: column;
    gap: 4px;
  }
  
  .action-buttons .el-button {
    width: 100%;
  }
}
</style>

<style scoped>
/* E-sign Tab Styles */
.esign-upload-section {
  margin-bottom: 2rem;
}

.esign-upload-section .upload-header {
  margin-bottom: 1rem;
}

.esign-upload-section .upload-header h4 {
  color: #2c3e50;
  margin-bottom: 0.5rem;
}

.esign-upload-section .upload-description {
  color: #666;
  font-size: 0.9rem;
  line-height: 1.4;
}

.esign-upload-section .upload-actions {
  margin-top: 1rem;
}

.esign-documents-section .documents-header {
  margin-bottom: 1.5rem;
}

.esign-documents-section .documents-header h4 {
  color: #2c3e50;
  margin-bottom: 0.5rem;
}

.esign-documents-section .documents-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.esign-documents-section .document-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem;
  border: 1px solid #e8eaed;
  border-radius: 8px;
  background: #fafbfc;
  transition: all 0.2s ease;
}

.esign-documents-section .document-item:hover {
  border-color: #409eff;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.1);
}

.esign-documents-section .document-info {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex: 1;
}

.esign-documents-section .document-icon {
  font-size: 2rem;
  color: #409eff;
}

.esign-documents-section .document-details h5 {
  margin: 0 0 0.5rem 0;
  color: #2c3e50;
  font-size: 1.1rem;
}

.esign-documents-section .document-meta {
  margin: 0 0 0.5rem 0;
  color: #666;
  font-size: 0.85rem;
}

.esign-documents-section .document-meta .separator {
  margin: 0 0.5rem;
}

.esign-documents-section .signature-status {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.esign-documents-section .signed-by {
  font-size: 0.8rem;
  color: #666;
}

.esign-documents-section .document-actions {
  display: flex;
  gap: 0.5rem;
}

.esign-empty-state {
  text-align: center;
  padding: 2rem;
}

/* Enhanced signature display styles */
/*.signatures-section {
  padding: 0.75rem;
  background: #f8fbff;
  border: 1px solid #e8f4ff;
  border-radius: 6px;
}*/

.signatures-section h5 {
  margin: 0 0 1rem 0;
  color: #2c3e50;
  font-size: 0.95rem;
  font-weight: 600;
}

.signature-item {
  margin-bottom: 1rem;
}

.signature-item:last-child {
  margin-bottom: 0;
}

.signature-details {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 0.75rem;
  background: white;
  border: 1px solid #e8eaed;
  border-radius: 4px;
}

.signature-image {
  max-height: 60px;
  max-width: 120px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  flex-shrink: 0;
}

.signature-info {
  flex: 1;
  min-width: 0;
}

.signer-name {
  font-weight: 600;
  color: #2c3e50;
  font-size: 0.9rem;
  margin-bottom: 0.25rem;
}

.signer-email {
  color: #666;
  font-size: 0.8rem;
  margin-bottom: 0.25rem;
}

.signature-date {
  color: #409eff;
  font-size: 0.8rem;
  font-weight: 500;
  margin-bottom: 0.25rem;
}

.signature-location {
  color: #999;
  font-size: 0.75rem;
  font-family: monospace;
}

@media (max-width: 768px) {
  .signature-details {
    flex-direction: column;
    gap: 0.75rem;
  }
  
  .signature-image {
    align-self: center;
  }
}

/* Condensed Parent Task Section */
.task-parent-condensed {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 8px 0;
  font-size: 13px;
  min-height: 32px;
}
.parent-label {
  color: #888;
  font-size: 13px;
  margin-right: 4px;
}
.parent-select-condensed {
  min-width: 160px;
  max-width: 220px;
}
.set-parent-link {
  color: #409EFF;
  font-size: 13px;
  padding: 0 4px;
  min-width: 0;
}
.view-parent-btn-condensed {
  padding: 0 4px;
  min-width: 0;
}

/* Condensed Child Tasks Section */
.task-children-condensed {
  margin: 0 0 8px 0;
  padding: 0;
  background: none;
  border: none;
}
.child-tasks-header-section-condensed {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
  font-size: 14px;
}
.child-tasks-title {
  font-weight: 500;
  color: #333;
}
.create-child-btn-condensed {
  font-size: 13px;
  padding: 2px 8px;
  min-width: 0;
}
.child-tasks-table-condensed {
  border: 1px solid #eee;
  border-radius: 4px;
  overflow: hidden;
  margin-top: 0;
}
.child-tasks-header-condensed {
  display: grid;
  grid-template-columns: 1fr 90px 80px;
  background: #fafbfc;
  font-size: 13px;
  color: #666;
  padding: 4px 0;
}
.child-tasks-header-condensed > div {
  padding: 6px 8px;
}
.child-task-row-condensed {
  display: grid;
  grid-template-columns: 1fr 90px 80px;
  font-size: 13px;
  border-bottom: 1px solid #f0f0f0;
  background: #fff;
}
.child-task-row-condensed:last-child {
  border-bottom: none;
}
.child-task-row-condensed > div {
  padding: 6px 8px;
  display: flex;
  align-items: center;
}
.no-child-tasks-condensed {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  min-height: 32px;
  padding: 0;
}

.parent-child-actions-row {
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
  align-items: center;
}

/* Compact Task Metadata Section */
.task-metadata-compact {
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  padding: 10px 16px;
  margin: 10px 0 0 0;
  background: #fff;
}
.metadata-row-compact {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
  justify-content: flex-start;
}
.metadata-item-compact {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  min-width: 140px;
}
.meta-value {
  color: #888;
  font-size: 13px;
}
.assignee-select-compact {
  min-width: 120px;
  max-width: 180px;
}

/* Compact Description Box */
.description-wrapper-compact {
  margin-top: 12px;
  background: #fafbfc;
  border-radius: 6px;
  padding: 12px 16px;
  border: 1px solid #eee;
}
.description-header-compact {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.desc-title {
  font-weight: 600;
  font-size: 15px;
  color: #222;
}
.desc-edit-btn {
  font-size: 12px;
  color: #409EFF;
  padding: 0 4px;
}
.description-wrapper-compact > p.description {
  padding-left: 8px;
  border-left: 2px solid var(--el-color-primary-light-5);
  font-size: 14px;
  margin: 0;
  color: #444;
  background: none;
}

.add-child-task-row {
  margin: 8px 0 0 0;
  display: flex;
  align-items: center;
}
</style>

<style>
.description-wrapper-compact > p.description > p {
    margin: 0;
    line-height: 20px;
}
.task-tabs-section .el-tabs__header {
    margin-bottom: 0;
}
</style>

<style scoped>
.metadata-popover-compact {
  padding: 8px !important;
}
.metadata-options-compact {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.metadata-option-compact {
  padding: 4px;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.2s;
  width: 100%;
}
.metadata-option-compact.selected {
  background-color: var(--el-fill-color-light);
}
.metadata-option-compact:hover {
  background-color: var(--el-fill-color-lighter);
}
.clickable-tag-compact {
  cursor: pointer;
  user-select: none;
  border: 1px solid #e0e0e0;
  background: #f9f9f9;
  transition: box-shadow 0.2s;
}
.clickable-tag-compact:hover {
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.08);
  background: #f0f8ff;
}
.due-date-popover-compact {
  padding: 10px !important;
}
.due-date-editor-compact {
  padding: 4px 0;
}
.due-date-actions-compact {
  display: flex;
  justify-content: flex-end;
  margin-top: 6px;
}

/* History content styles for proper HTML rendering */
.comment-history .previous-content {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  padding: 12px;
  margin: 8px 0;
  font-size: 14px;
  line-height: 1.5;
}

.comment-history .previous-content table {
  border-collapse: collapse;
  width: 100%;
  margin: 8px 0;
}

.comment-history .previous-content table th,
.comment-history .previous-content table td {
  border: 1px solid #ddd;
  padding: 8px;
  text-align: left;
}

.comment-history .previous-content table th {
  background-color: #f2f2f2;
  font-weight: 600;
}

.comment-history .previous-content ul,
.comment-history .previous-content ol {
  margin: 8px 0;
  padding-left: 20px;
}

.comment-history .previous-content li {
  margin: 4px 0;
}

.comment-history .previous-content blockquote {
  border-left: 4px solid #ddd;
  margin: 8px 0;
  padding-left: 12px;
  color: #666;
}

.comment-history .previous-content code {
  background-color: #f1f1f1;
  padding: 2px 4px;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
}

.comment-history .previous-content pre {
  background-color: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  padding: 12px;
  overflow-x: auto;
  margin: 8px 0;
}

.comment-history .previous-content h1,
.comment-history .previous-content h2,
.comment-history .previous-content h3,
.comment-history .previous-content h4,
.comment-history .previous-content h5,
.comment-history .previous-content h6 {
  margin: 12px 0 8px 0;
  font-weight: 600;
}

.comment-history .previous-content p {
  margin: 8px 0;
}

/* Create task button styles */
.create-task-btn {
  min-width: 40px;
  padding: 8px 12px;
}

.create-task-btn .el-icon {
  font-size: 16px;
}

/* Create task dialog styles */
.create-task-dialog .el-dialog__body {
  padding: 20px;
}

.show-more-container {
  margin: 16px 0;
  text-align: center;
}

/* Move to button styles */
.move-to-btn {
  min-width: 40px;
  padding: 8px 12px;
}

.move-to-btn .el-icon {
  font-size: 14px;
  margin-right: 4px;
}

/* Move to dialog styles */
.move-to-dialog .el-dialog__body {
  padding: 20px;
}

.move-to-content {
  margin-bottom: 16px;
}

.move-to-description {
  color: #666;
  font-size: 14px;
  line-height: 1.5;
  margin-bottom: 20px;
}
</style>