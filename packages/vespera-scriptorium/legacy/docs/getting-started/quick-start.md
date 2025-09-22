# Quick Start Tutorial

**Create your first Vespera V2 project and experience intelligent task orchestration in 5 minutes.**

## 🎯 What You'll Learn

In this quick tutorial, you'll:
- Create your first hierarchical task project
- Experience AI-powered semantic search
- Use role-based task execution
- See real-time project intelligence in action

**Time Required**: 5-10 minutes  
**Prerequisites**: [Vespera V2 installed](installation.md) and running

## 🚀 Step 1: Verify Installation

First, let's make sure Vespera V2 is running:

```bash
# Check MCP server status
python -c "from mcp_server_v2 import get_managers; print('✓ Vespera V2 is ready')"

# Start the MCP server if not running
./run_v2_server.sh

# Optional: Start REST API for web access
python run_api_server.py &
```

If using Claude Code, verify the MCP connection:
```bash
# In Claude Code, run:
List available MCP tools for vespera-scriptorium
```

## 📋 Step 2: Create Your First Project

Let's create a simple web application project to demonstrate Vespera's capabilities:

### Using MCP Tools (Recommended)

If you have Claude Code with MCP integration:

```python
# Create the main project task
create_task_tree({
    "title": "Personal Portfolio Website",
    "description": "Build a modern portfolio website with responsive design",
    "project_id": "portfolio-web",
    "feature": "web-development",
    "subtasks": [
        {
            "title": "Setup project structure",
            "description": "Initialize HTML, CSS, JS files and folder structure",
            "role": "frontend_developer",
            "priority": "high"
        },
        {
            "title": "Design responsive layout",
            "description": "Create mobile-first responsive CSS layouts",
            "role": "frontend_developer",
            "priority": "high"
        },
        {
            "title": "Implement interactive features",
            "description": "Add smooth scrolling, animations, and form handling",
            "role": "frontend_developer",
            "priority": "normal"
        },
        {
            "title": "Optimize for performance",
            "description": "Minify assets, optimize images, implement lazy loading",
            "role": "performance_engineer",
            "priority": "normal"
        },
        {
            "title": "Deploy to hosting",
            "description": "Configure deployment pipeline and hosting setup",
            "role": "devops_engineer",
            "priority": "normal"
        }
    ]
})
```

### Using REST API

If you prefer REST API calls:

```bash
curl -X POST "http://localhost:8000/api/v1/tasks/trees" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Personal Portfolio Website",
    "description": "Build a modern portfolio website with responsive design",
    "project_id": "portfolio-web",
    "feature": "web-development",
    "subtasks": [
      {
        "title": "Setup project structure",
        "description": "Initialize HTML, CSS, JS files and folder structure",
        "role": "frontend_developer",
        "priority": "high"
      },
      {
        "title": "Design responsive layout", 
        "description": "Create mobile-first responsive CSS layouts",
        "role": "frontend_developer",
        "priority": "high"
      }
    ]
  }'
```

### Using Python Directly

For direct system access:

```python
from tasks import TaskManager
from roles import RoleManager

# Initialize managers
role_manager = RoleManager('.')
task_manager = TaskManager('.', role_manager)

# Create the main project
main_task = task_manager.create_task(
    title="Personal Portfolio Website",
    description="Build a modern portfolio website with responsive design",
    project_id="portfolio-web"
)

# Create subtasks
setup_task = task_manager.create_task(
    title="Setup project structure",
    description="Initialize HTML, CSS, JS files and folder structure",
    parent_id=main_task.task_id,
    role="frontend_developer",
    priority="high"
)

design_task = task_manager.create_task(
    title="Design responsive layout",
    description="Create mobile-first responsive CSS layouts", 
    parent_id=main_task.task_id,
    role="frontend_developer",
    priority="high"
)

print(f"✓ Created project: {main_task.task_id}")
print(f"✓ Created {len(task_manager.get_children(main_task.task_id))} subtasks")
```

## 🔍 Step 3: Explore Semantic Search

One of Vespera's most powerful features is AI-powered semantic search. Let's try it:

### Search for Related Tasks

```python
# Using MCP tools
search_results = semantic_search({
    "query": "CSS responsive design mobile",
    "n_results": 5,
    "min_similarity": 0.7
})

# View results
for result in search_results["results"]:
    print(f"📋 {result['title']} (similarity: {result['similarity']:.2f})")
    print(f"   {result['description'][:100]}...")
```

### Find Similar Tasks

```python
# Get the design task ID (replace with actual ID from step 2)
design_task_id = "your-design-task-id"

# Find similar tasks
similar_tasks = find_similar_tasks({
    "task_id": design_task_id,
    "n_results": 3
})

print("Tasks similar to 'Design responsive layout':")
for task in similar_tasks["similar_tasks"]:
    print(f"📋 {task['title']} (similarity: {task['similarity']:.2f})")
```

## 👥 Step 4: Explore Role-Based Execution

Vespera V2 includes a sophisticated role system. Let's see what roles are available:

```python
# List all available roles
roles = list_roles()

print("Available roles:")
for role in roles["roles"]:
    print(f"👤 {role['name']}: {role['description']}")
    print(f"   Capabilities: {', '.join(role['capabilities'])}")
    print(f"   File patterns: {', '.join(role['file_patterns'])}")
```

### Assign Roles to Tasks

```python
# Assign the frontend developer role to the setup task
assign_role_to_task({
    "task_id": setup_task.task_id,
    "role_name": "frontend_developer"
})

# Check role assignments
task_details = get_task({"task_id": setup_task.task_id})
print(f"✓ Task '{task_details['task']['title']}' assigned to: {task_details['task']['role']}")
```

## 📊 Step 5: View Project Dashboard

Get insights into your project's health and progress:

```python
# Get project dashboard
dashboard = get_task_dashboard()

print(f"📊 Dashboard Summary:")
print(f"   Total tasks: {dashboard['summary']['total_tasks']}")
print(f"   Completed: {dashboard['summary']['completed_tasks']}")
print(f"   In progress: {dashboard['summary']['in_progress_tasks']}")
print(f"   Pending: {dashboard['summary']['pending_tasks']}")

# View recent activity
print(f"\n📈 Recent Activity:")
for activity in dashboard['recent_activity'][:3]:
    print(f"   {activity['type']}: {activity['task_title']} at {activity['timestamp']}")
```

## 🌲 Step 6: Visualize Task Hierarchy

See your project structure as a tree:

```python
# Get the task tree for your main project
task_tree = get_task_tree({"task_id": main_task.task_id})

def print_tree(node, level=0):
    indent = "  " * level
    status_emoji = {"pending": "⏳", "in_progress": "🚀", "completed": "✅"}
    emoji = status_emoji.get(node['status'], "📋")
    
    print(f"{indent}{emoji} {node['title']}")
    if node.get('role'):
        print(f"{indent}   👤 Assigned to: {node['role']}")
    
    for child in node.get('children', []):
        print_tree(child, level + 1)

print("📁 Project Structure:")
print_tree(task_tree['tree'])
```

## ⚡ Step 7: Experience Real-time Updates

If you're using the REST API, you can connect to real-time updates:

### JavaScript WebSocket Example

```javascript
// Connect to WebSocket for real-time updates
const ws = new WebSocket('ws://localhost:8000/ws/plugins?token=your-token');

ws.onopen = function() {
    console.log('✓ Connected to Vespera V2');
    
    // Subscribe to task events
    ws.send(JSON.stringify({
        type: 'subscribe',
        events: ['task.created', 'task.updated', 'task.completed']
    }));
};

ws.onmessage = function(event) {
    const message = JSON.parse(event.data);
    console.log('📢 Real-time update:', message);
    
    if (message.type === 'task.updated') {
        console.log(`Task "${message.data.title}" was updated`);
    }
};
```

### Update a Task to See Live Updates

```python
# Complete the setup task
complete_task({
    "task_id": setup_task.task_id,
    "output": "Project structure initialized with index.html, styles.css, and script.js",
    "artifacts": ["index.html", "styles.css", "script.js"]
})

# The WebSocket will receive a real-time notification!
```

## 🎯 Step 8: Advanced Features Preview

### Dependency Analysis

```python
# Analyze project dependencies
dependencies = analyze_task_dependencies({"task_id": main_task.task_id})

print("🔗 Task Dependencies:")
for dep in dependencies['dependencies']:
    print(f"   {dep['task_title']} depends on {dep['depends_on_title']}")

if dependencies['cycles']:
    print("⚠️  Dependency cycles detected!")
```

### Smart Recommendations

```python
# Get AI-powered task recommendations
recommendations = get_recommendations({
    "project_id": "portfolio-web",
    "n_recommendations": 3
})

print("💡 Smart Recommendations:")
for rec in recommendations['recommendations']:
    print(f"   📋 {rec['title']}")
    print(f"      Reason: {rec['reasoning']}")
    print(f"      Confidence: {rec['confidence']:.2f}")
```

## 🎉 Congratulations!

You've successfully:

✅ **Created a hierarchical project** with parent and child tasks  
✅ **Experienced semantic search** powered by AI embeddings  
✅ **Explored role-based task assignment** with capability restrictions  
✅ **Viewed project insights** through the dashboard  
✅ **Visualized task relationships** in a tree structure  
✅ **Seen real-time updates** via WebSocket connections  
✅ **Previewed advanced features** like dependency analysis  

## 🚀 Next Steps

Now that you've experienced Vespera V2's core capabilities, explore these areas:

### **Immediate Next Steps**
1. **[Create Your First Real Project](first-project.md)** - Detailed project setup walkthrough
2. **[Master Task Management](../users/task-management.md)** - Deep dive into hierarchical workflows
3. **[Explore Project Templates](../users/project-templates.md)** - Accelerate setup with templates

### **Plugin Integration**
1. **[VS Code Integration](../developers/plugin-development/vscode-integration.md)** - Integrate with your IDE
2. **[Obsidian Integration](../developers/plugin-development/obsidian-integration.md)** - Connect with your knowledge base
3. **[REST API Exploration](../developers/api-reference.md)** - Build custom integrations

### **Advanced Features**
1. **[Workflow Automation](../users/workflow-automation.md)** - Set up automated task workflows
2. **[Background Services](../admin/configuration.md#background-services)** - Configure automatic maintenance
3. **[Performance Optimization](../admin/monitoring.md)** - Monitor and optimize performance

## 💡 Pro Tips for Success

### **Organization Tips**
- **Use descriptive titles**: Clear task titles improve semantic search accuracy
- **Leverage project IDs**: Group related tasks with consistent project identifiers
- **Tag effectively**: Use relevant tags for better task categorization

### **Role Assignment Strategy**
- **Match capabilities**: Assign roles that have the required capabilities for each task
- **Consider file patterns**: Roles include file pattern restrictions for security
- **Review workload**: Use workload analysis to balance assignments

### **Search and Discovery**
- **Experiment with queries**: Try different search terms to discover related tasks
- **Use similarity thresholds**: Adjust similarity settings to find the right balance
- **Explore recommendations**: Let AI suggest relevant tasks and improvements

## 🔍 Understanding What Happened

During this tutorial, Vespera V2 demonstrated several key capabilities:

### **Hierarchical Task Management**
- Tasks automatically form parent-child relationships
- Dependencies are tracked and validated
- Project health is continuously monitored

### **AI-Powered Intelligence**
- Task descriptions are automatically converted to embeddings
- Semantic search finds conceptually related tasks
- Recommendations are generated based on project context

### **Role-Based Security**
- Tasks are assigned to roles with specific capabilities
- File access is restricted based on role permissions
- Workload is balanced across available roles

### **Real-time Coordination**
- Changes propagate immediately through WebSocket connections
- Background services maintain data consistency
- Performance is optimized through automatic indexing

## 🆘 Troubleshooting Quick Issues

### **Common Quick Start Problems**

**MCP Tools Not Available**
```bash
# Restart MCP server
./run_v2_server.sh

# Check Claude Code MCP connection
claude mcp list | grep vespera-scriptorium
```

**Slow Search Results**
```bash
# Check embedding service status
python -c "from databases import BackgroundServiceManager; print(BackgroundServiceManager().get_service_status())"

# Force embedding generation
python -c "from databases import ChromaService; ChromaService().initialize()"
```

**Tasks Not Appearing**
```bash
# Check database integrity
python -c "from tasks import TaskManager; tm = TaskManager('.'); print(f'Total tasks: {len(tm.list_tasks())}')"

# Verify task creation
python -c "from mcp_server_v2 import get_managers; tm, rm = get_managers(); tasks = tm.list_tasks(); print(f'Found {len(tasks)} tasks')"
```

---

**🎉 You're now ready to harness the full power of Vespera V2!**

*Next: [Create Your First Real Project](first-project.md) for a deeper dive into project setup and management.*