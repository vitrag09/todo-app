// Task data structure
let todos = [];
const STORAGE_KEY = 'todos';

// DOM Elements
const taskInput = document.getElementById('taskInput');
const addTaskBtn = document.getElementById('addTaskBtn');
const columns = document.querySelectorAll('.column');
const taskCounters = document.querySelectorAll('.task-count');

// Initialize the board
function initializeBoard() {
    loadTodos();
    renderTodos();
    updateTaskSummary();
    
    // Add task input handler
    taskInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && taskInput.value.trim()) {
            addTodo(taskInput.value.trim());
            taskInput.value = '';
        }
    });
    
    // Set up drag and drop for columns
    columns.forEach(column => {
        column.addEventListener('dragover', dragOver);
        column.addEventListener('drop', drop);
    });
}

// Format time for display
function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    } else {
        return `${secs}s`;
    }
}

// Create a new task element
function createTaskElement(todo) {
    const taskElement = document.createElement('div');
    // Only add running class if task is not completed
    taskElement.className = `task${todo.completed ? ' completed' : (todo.isRunning ? ' running' : '')}`;
    taskElement.draggable = true;
    taskElement.dataset.id = todo.id;
    taskElement.dataset.stage = todo.stage;

    const taskContent = document.createElement('div');
    taskContent.className = 'task-content';

    const taskText = document.createElement('p');
    taskText.className = 'task-text';
    taskText.textContent = todo.text;
    
    // Make task text editable with double click (only for non-completed tasks)
    if (!todo.completed) {
        taskText.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            const input = document.createElement('input');
            input.type = 'text';
            input.value = todo.text;
            input.className = 'task-edit-input';
            
            // Replace text with input
            taskText.replaceWith(input);
            input.focus();
            
            const saveEdit = () => {
                const newText = input.value.trim();
                if (newText && newText !== todo.text) {
                    todo.text = newText;
                    taskText.textContent = newText;
                    saveTodos();
                }
                input.replaceWith(taskText);
            };
            
            input.addEventListener('blur', saveEdit);
            input.addEventListener('keyup', (e) => {
                if (e.key === 'Enter') {
                    saveEdit();
                } else if (e.key === 'Escape') {
                    input.replaceWith(taskText);
                }
            });
        });
    }

    const taskActions = document.createElement('div');
    taskActions.className = 'task-actions';

    const timerDisplay = document.createElement('span');
    timerDisplay.className = 'timer-display';
    timerDisplay.textContent = formatTime(todo.totalTime || 0);
    taskActions.appendChild(timerDisplay);

    // Add copy button for all tasks (including completed ones)
    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
    copyBtn.title = 'Copy Task Text';
    copyBtn.onclick = async (e) => {
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(todo.text);
            // Show brief success feedback
            copyBtn.innerHTML = '<i class="fas fa-check"></i>';
            setTimeout(() => {
                copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
            }, 1000);
        } catch (err) {
            console.error('Failed to copy text:', err);
        }
    };
    taskActions.appendChild(copyBtn);

    // Only show timer and done buttons for non-completed tasks
    if (!todo.completed) {
        const timerBtn = document.createElement('button');
        timerBtn.className = 'timer-btn';
        timerBtn.innerHTML = todo.isRunning ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>';
        timerBtn.title = todo.isRunning ? 'Pause Timer' : 'Start Timer';
        timerBtn.onclick = (e) => {
            e.stopPropagation();
            toggleTimer(todo.id);
        };
        taskActions.appendChild(timerBtn);

        // Add done button only for in-progress tasks that are not completed
        if (todo.stage === 'inProgress') {
            const doneBtn = document.createElement('button');
            doneBtn.className = 'done-btn';
            doneBtn.innerHTML = '<i class="fas fa-check"></i>';
            doneBtn.title = 'Mark as Done';
            doneBtn.onclick = (e) => {
                e.stopPropagation();
                moveTask(todo.id, 'done');
            };
            taskActions.appendChild(doneBtn);
        }
    }

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
    deleteBtn.title = 'Delete Task';
    deleteBtn.onclick = (e) => {
        e.stopPropagation();
        deleteTodo(todo.id);
    };
    taskActions.appendChild(deleteBtn);

    taskContent.appendChild(taskText);
    taskElement.appendChild(taskContent);
    taskElement.appendChild(taskActions);

    taskElement.addEventListener('dragstart', (e) => {
        draggedTask = taskElement;
        e.dataTransfer.setData('text/plain', '');
        taskElement.classList.add('dragging');
    });

    taskElement.addEventListener('dragend', () => {
        draggedTask = null;
        taskElement.classList.remove('dragging');
    });

    // Only add click handler for completion if task is not in done stage
    if (todo.stage !== 'done') {
        taskElement.addEventListener('click', () => {
            toggleTodoComplete(todo.id);
        });
    }

    return taskElement;
}

// Add a new task
function addTodo(text) {
    const todo = {
        id: Date.now().toString(),
        text: text.trim(),
        stage: 'todo',
        totalTime: 0,
        isRunning: false,
        timerInterval: null
    };

    todos.push(todo);
    saveTodos();

    const taskElement = createTaskElement(todo);
    const column = document.querySelector(`.tasks[data-stage="todo"]`);
    column.appendChild(taskElement);
    
    updateTaskCounters();
    updateTaskSummary();
}

// Delete a task
function deleteTodo(id) {
    const todo = todos.find(t => t.id === id);
    if (todo && todo.timerInterval) {
        clearInterval(todo.timerInterval);
    }
    
    todos = todos.filter(t => t.id !== id);
    saveTodos();
    
    const taskElement = document.querySelector(`.task[data-id="${id}"]`);
    if (taskElement) {
        taskElement.remove();
    }
    
    updateTaskCounters();
    updateTaskSummary();
}

// Move task to a different stage
function moveTask(id, newStage) {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;

    const oldStage = todo.stage;
    if (oldStage === newStage) return;

    const taskElement = document.querySelector(`.task[data-id="${id}"]`);
    if (!taskElement) return;

    // Validate stage transitions
    if (newStage === 'done' && oldStage !== 'inProgress') {
        return; // Can only move to done from in progress
    }

    // Update task stage and state
    todo.stage = newStage;
    
    // Handle stage-specific logic
    if (newStage === 'done') {
        todo.completed = true;
        todo.isRunning = false; // Ensure running state is cleared
        if (todo.timerInterval) {
            clearInterval(todo.timerInterval);
            todo.timerInterval = null;
        }
    } else if (newStage === 'todo') {
        todo.completed = false;
        todo.isRunning = false; // Reset running state when moving back to todo
        if (todo.timerInterval) {
            clearInterval(todo.timerInterval);
            todo.timerInterval = null;
        }
    }

    // Move task element to new column with updated state
    const newColumn = document.querySelector(`.tasks[data-stage="${newStage}"]`);
    if (newColumn) {
        // Remove the task from its current column
        taskElement.remove();
        
        // Create a fresh task element with updated state
        const newTaskElement = createTaskElement(todo);
        
        // Add to the new column
        newColumn.appendChild(newTaskElement);
    }

    saveTodos();
    updateTaskCounters();
    updateTaskSummary();
}

// Mark task as done
function markAsDone(todoId) {
    const todo = todos.find(t => t.id === todoId);
    if (!todo) return;

    // Stop timer if running
    if (todo.timerInterval) {
        clearInterval(todo.timerInterval);
    }
    
    todo.isRunning = false;
    moveTask(todoId, 'done');
}

// Toggle timer for a task
function toggleTimer(id) {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;

    const wasRunning = todo.isRunning;
    todo.isRunning = !wasRunning;
    
    const taskElement = document.querySelector(`.task[data-id="${id}"]`);
    if (!taskElement) return;
    
    const timerBtn = taskElement.querySelector('.timer-btn');
    const timerDisplay = taskElement.querySelector('.timer-display');
    
    if (todo.isRunning) {
        timerBtn.innerHTML = '<i class="fas fa-pause"></i>';
        taskElement.classList.add('running');
        
        // Move to in progress when starting timer
        if (todo.stage !== 'inProgress') {
            moveTask(id, 'inProgress');
        }
        
        todo.timerInterval = setInterval(() => {
            todo.totalTime += 1;
            if (timerDisplay) {
                timerDisplay.textContent = formatTime(todo.totalTime);
            }
            saveTodos();
        }, 1000);
    } else {
        timerBtn.innerHTML = '<i class="fas fa-play"></i>';
        taskElement.classList.remove('running');
        
        // Move back to todo when stopping timer if it was in progress
        if (todo.stage === 'inProgress') {
            moveTask(id, 'todo');
        }
        
        if (todo.timerInterval) {
            clearInterval(todo.timerInterval);
            todo.timerInterval = null;
        }
    }
    
    saveTodos();
    updateTaskCounters();
    updateTaskSummary();
}

// Update task counters for each column
function updateTaskCounters() {
    const stages = ['todo', 'inProgress', 'done'];
    stages.forEach(stage => {
        const count = todos.filter(todo => todo.stage === stage).length;
        const counter = document.querySelector(`.column[data-stage="${stage}"] .task-count`);
        if (counter) {
            counter.textContent = count;
        }
    });
}

// Update task summary counts
function updateTaskSummary() {
    const todoCount = todos.filter(todo => todo.stage === 'todo').length;
    const inProgressCount = todos.filter(todo => todo.stage === 'inProgress').length;
    const doneCount = todos.filter(todo => todo.stage === 'done').length;
    const totalCount = todoCount + inProgressCount + doneCount;

    document.querySelector('.summary-item.todo .count').textContent = todoCount;
    document.querySelector('.summary-item.in-progress .count').textContent = inProgressCount;
    document.querySelector('.summary-item.done .count').textContent = doneCount;
    document.querySelector('.summary-item.total .count').textContent = totalCount;
}

// Load todos from localStorage
function loadTodos() {
    const savedTodos = localStorage.getItem(STORAGE_KEY);
    todos = savedTodos ? JSON.parse(savedTodos) : [];
    
    // Initialize timer intervals for running tasks
    todos.forEach(todo => {
        // Ensure completed tasks are never running
        if (todo.completed) {
            todo.isRunning = false;
        }
        
        if (todo.isRunning) {
            todo.timerInterval = setInterval(() => {
                todo.totalTime += 1;
                const taskElement = document.querySelector(`.task[data-id="${todo.id}"]`);
                if (taskElement) {
                    const display = taskElement.querySelector('.timer-display');
                    if (display) {
                        display.textContent = formatTime(todo.totalTime);
                    }
                }
                saveTodos();
            }, 1000);
        }
    });
}

// Save todos to localStorage
function saveTodos() {
    // Create a clean copy without interval references
    const todosToSave = todos.map(todo => ({
        id: todo.id,
        text: todo.text,
        completed: todo.completed,
        stage: todo.stage,
        totalTime: todo.totalTime,
        // Never save running state for completed tasks
        isRunning: todo.completed ? false : todo.isRunning
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todosToSave));
}

// Render all todos
function renderTodos() {
    // Clear all columns
    document.querySelectorAll('.tasks').forEach(column => {
        column.innerHTML = '';
    });

    // Sort todos by creation time (newest first)
    todos.sort((a, b) => b.id - a.id);

    // Render each todo in its appropriate column
    todos.forEach(todo => {
        const taskElement = createTaskElement(todo);
        const column = document.querySelector(`.tasks[data-stage="${todo.stage}"]`);
        if (column) {
            column.appendChild(taskElement);
        }
    });

    updateTaskCounters();
    updateTaskSummary();
}

// Add event listeners for drag and drop
document.querySelectorAll('.tasks').forEach(column => {
    column.addEventListener('dragover', e => {
        e.preventDefault();
        const dragging = document.querySelector('.dragging');
        if (!dragging) return;
        
        const stage = column.dataset.stage;
        if (stage === 'done' && dragging.dataset.stage !== 'inProgress') {
            return; // Only allow dropping to done from in progress
        }
        
        column.classList.add('drag-over');
    });

    column.addEventListener('dragleave', () => {
        column.classList.remove('drag-over');
    });

    column.addEventListener('drop', e => {
        e.preventDefault();
        column.classList.remove('drag-over');
        
        if (!draggedTask) return;
        
        const newStage = column.dataset.stage;
        const taskId = draggedTask.dataset.id;
        
        // Only allow dropping to done from in progress
        if (newStage === 'done' && draggedTask.dataset.stage !== 'inProgress') {
            return;
        }
        
        moveTask(taskId, newStage);
    });
});

// Event listener for adding new tasks
taskInput.addEventListener('keyup', e => {
    if (e.key === 'Enter' && taskInput.value.trim()) {
        addTodo(taskInput.value);
        taskInput.value = '';
    }
});

// Drag and Drop Functionality
let draggedTask = null;

function dragStart(e) {
    draggedTask = e.target;
    e.target.classList.add('dragging');
}

function dragEnd(e) {
    e.target.classList.remove('dragging');
    draggedTask = null;
}

function drop(e) {
    e.preventDefault();
    const dropZone = e.target.closest('.tasks');
    if (!dropZone || !draggedTask) return;

    const newStage = dropZone.dataset.stage;
    const todoId = draggedTask.dataset.id;
    
    // Update task stage in data
    const todo = todos.find(t => t.id === todoId);
    if (todo) {
        // Stop timer if moving to done
        if (newStage === 'done' && todo.timerInterval) {
            clearInterval(todo.timerInterval);
            todo.timerInterval = null;
            todo.isRunning = false;
        }
        
        todo.stage = newStage;
        saveTodos();
        
        // Update the task element to show/hide appropriate buttons
        const newTaskElement = createTaskElement(todo);
        draggedTask.replaceWith(newTaskElement);
    }

    updateTaskCounters();
    updateTaskSummary();
}

// Column Collapse Functionality
document.querySelectorAll('.collapse-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const column = e.target.closest('.column');
        column.classList.toggle('collapsed');
        
        // Update icon
        const icon = btn.querySelector('i');
        if (column.classList.contains('collapsed')) {
            icon.className = 'fas fa-chevron-right';
        } else {
            icon.className = 'fas fa-chevron-down';
        }
    });
});

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    initializeBoard();
});
