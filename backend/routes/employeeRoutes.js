import express from 'express';
import Employee from '../models/Employee.js';
import Course from '../models/Course.js';
import Project from '../models/Project.js';
import { registerEmployee, deleteEmployee,resetEmployeeAmount } from '../controllers/employeeController.js';

const router = express.Router();


router.post('/register', registerEmployee);




router.delete('/remove/:userId', deleteEmployee);




router.put('/reset-amount/:userId', resetEmployeeAmount);




router.get('/profile/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const employee = await Employee.findOne({ userId })
      .populate('enrolledCourses', 'title')
      .populate('completedCourses', 'title')
      .populate('projects', 'title')
      .populate('completedProjects', 'title');

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    res.json(employee);
  } catch (error) {
    console.error('Error fetching employee profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
});



router.post('/login', async (req, res) => {
  const { userId, password } = req.body;
  try {
    const employee = await Employee.findOne({ userId });
    if (!employee || employee.password !== password) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    res.status(200).json({
      employeeId: employee._id,
      name: employee.name,
      role: employee.role,
    });
  } catch (err) {
    res.status(500).json({ message: 'Login failed', error: err });
  }
});




router.get('/by-names', async (req, res) => {
  const namesParam = req.query.names;
  if (!namesParam) return res.status(400).json({ message: 'Missing names query parameter' });
  const names = namesParam.split(',').map(n => n.trim());
  try {
    const employees = await Employee.find({ name: { $in: names } });
    res.json(employees);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching employees by names' });
  }
});




router.get('/by-userIds', async (req, res) => {
  try {
    const idsParam = req.query.ids;
    if (!idsParam) return res.status(400).json({ error: 'No userIds provided' });

    const userIds = idsParam.split(',').map(id => id.trim());
    const employees = await Employee.find({ userId: { $in: userIds } });

    const result = {};
    employees.forEach(emp => {
      result[emp.userId] = emp._id;
    });

    return res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});




router.post('/names-from-ids', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ error: 'Invalid IDs array' });
    }
    const employees = await Employee.find({ _id: { $in: ids } });
    res.json(employees);
  } catch (err) {
    res.status(500).json({ error: 'Server error while resolving names from IDs' });
  }
});





router.post('/projects/:projectId/toggleTask', async (req, res) => {
  const { projectId } = req.params;
  const { taskIndex } = req.body;
  try {
    const project = await Project.findById(projectId);
    if (!project || !project.tasks[taskIndex]) {
      return res.status(404).json({ error: 'Project or task not found' });
    }
    project.tasks[taskIndex].completed = !project.tasks[taskIndex].completed;
    await project.save();
    res.status(200).json({ message: 'Task toggled successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Error toggling task' });
  }
});





router.put('/:projectId/add-employee', async (req, res) => {
  const { projectId } = req.params;
  const { employeeId } = req.body;

  try {
    const project = await Project.findByIdAndUpdate(
      projectId,
      { $addToSet: { assignedEmployees: employeeId } },
      { new: true }
    );

    if (!project) return res.status(404).json({ message: 'Project not found' });

    await Employee.findByIdAndUpdate(
      employeeId,
      { $addToSet: { projects: projectId } }
    );

    res.json({ message: 'Employee added to project', project });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});




router.put('/edit/:projectId', async (req, res) => {
  const { projectId } = req.params;
  const { title, description, tasks, assignedEmployeeUserIds, amount } = req.body;

  try {
    const existingProject = await Project.findById(projectId);
    if (!existingProject) return res.status(404).json({ message: 'Project not found' });

    const updateFields = { title, description, tasks, amount };

    let assignedEmployeeIds = [];

    if (Array.isArray(assignedEmployeeUserIds) && assignedEmployeeUserIds.length > 0) {
      const employees = await Employee.find({ userId: { $in: assignedEmployeeUserIds } });
      assignedEmployeeIds = employees.map(emp => emp._id);

      updateFields.assignedEmployees = assignedEmployeeIds;

      await Promise.all(
        employees.map(emp =>
          Employee.findByIdAndUpdate(emp._id, { $addToSet: { projects: projectId } })
        )
      );

      const oldEmployeeIds = existingProject.assignedEmployees.map(id => id.toString());
      const newEmployeeIdsStr = assignedEmployeeIds.map(id => id.toString());
      const removedEmployeeIds = oldEmployeeIds.filter(id => !newEmployeeIdsStr.includes(id));

      await Promise.all(
        removedEmployeeIds.map(empId =>
          Employee.findByIdAndUpdate(empId, { $pull: { projects: projectId } })
        )
      );
    } else {
      updateFields.assignedEmployees = existingProject.assignedEmployees;
    }

    const updatedProject = await Project.findByIdAndUpdate(projectId, updateFields, {
      new: true,
    }).populate('assignedEmployees', 'userId name');

    if (!updatedProject) return res.status(404).json({ message: 'Project not found after update' });

    res.status(200).json(updatedProject);
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ message: 'Server error' });
  }
});





router.get('/:id/enrolledCourses', async (req, res) => {
  try {
    const employee = await Employee.findOne({ userId: req.params.id }).populate('enrolledCourses');
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    res.json(employee.enrolledCourses);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});





router.get('/:id/completedCourses', async (req, res) => {
  try {
    const employee = await Employee.findOne({ userId: req.params.id }).populate('completedCourses');
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    res.json(employee.completedCourses);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});





router.post('/:id/completeCourse', async (req, res) => {
  const { courseId } = req.body;
  const { id: userId } = req.params;
  try {
    const employee = await Employee.findOne({ userId });
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: 'Course not found' });

    if (!employee.completedCourses.includes(course._id)) {
      employee.completedCourses.push(course._id);

      if (Array.isArray(course.badge)) {
        employee.badges.push(...course.badge);
      }

      const courseAmount = Number(course.amount) || 0;
      employee.amount += courseAmount;

      await employee.save();
    }

    res.status(200).json({ message: 'Course marked as completed' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});





router.get('/:id/assignedProjects', async (req, res) => {
  try {
    const employee = await Employee.findOne({ userId: req.params.id });
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    const projects = await Project.find({ assignedEmployees: employee._id }).populate('assignedEmployees', 'userId name');

    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch assigned projects' });
  }
});

router.put('/:id/add-project', async (req, res) => {
  const { id } = req.params;
  const { projectId } = req.body;

  try {
    const employee = await Employee.findById(id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    if (!employee.projects.includes(projectId)) {
      employee.projects.push(projectId);
      await employee.save();
    }

    res.json(employee);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:employeeId/remove-project', async (req, res) => {
  const { employeeId } = req.params;
  const { projectId } = req.body;

  if (!projectId) {
    return res.status(400).json({ message: 'Project ID is required in request body' });
  }

  try {
    const updatedEmployee = await Employee.findByIdAndUpdate(
      employeeId,
      { $pull: { projects: projectId } },
      { new: true }
    );

    if (!updatedEmployee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    res.json({ message: 'Project removed from employee', employee: updatedEmployee });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/:id/complete-project', async (req, res) => {
  const employeeId = req.params.id;
  const { projectId, amount } = req.body;

  if (!projectId) {
    return res.status(400).json({ message: 'Project ID is required' });
  }

  try {
    const employee = await Employee.findById(employeeId);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    employee.assignedProjects = employee.assignedProjects?.filter(
      pid => pid.toString() !== projectId
    );

    if (!employee.completedProjects) employee.completedProjects = [];
    if (!employee.completedProjects.includes(projectId)) {
      employee.completedProjects.push(projectId);
    }

    if (amount && !isNaN(amount)) {
      employee.totalEarnings = (employee.totalEarnings || 0) + amount;
    }

    await employee.save();

    res.json({ message: 'Project marked as completed for employee' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});





router.delete('/:projectId', async (req, res) => {
  const { projectId } = req.params;
  try {
    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    await Employee.updateMany(
      { _id: { $in: project.assignedEmployees } },
      { $pull: { projects: project._id } }
    );

    await project.deleteOne();
    res.status(200).json({ message: 'Project deleted and employee references removed' });
  } catch (error) {
    console.error('Server error while deleting project:', error);
    res.status(500).json({ message: 'Server error while deleting project' });
  }
});





router.get('/', async (req, res) => {
  try {
    const employees = await Employee.find({}, 'userId name Email role badges tags');
    res.json(employees);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching employees' });
  }
});






router.get('/:id', async (req, res) => {
  try {
    const employee = await Employee.findOne({ userId: req.params.id });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });
    res.json(employee);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});


export default router;