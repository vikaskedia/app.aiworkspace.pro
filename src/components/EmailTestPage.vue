<template>
    <div class="email-test-container">
      <h2>Email Test Form</h2>
      
      <el-form 
        :model="emailForm" 
        :rules="rules"
        ref="emailFormRef"
        label-position="top">
        
        <el-form-item label="To" prop="to">
          <el-input v-model="emailForm.to" placeholder="Recipient email" />
        </el-form-item>
  
        <el-form-item label="From" prop="from">
          <el-input v-model="emailForm.from" placeholder="Sender email" />
        </el-form-item>
  
        <el-form-item label="From Name" prop="fromName">
          <el-input v-model="emailForm.fromName" placeholder="Sender name" />
        </el-form-item>
  
        <el-form-item label="Subject" prop="subject">
          <el-input v-model="emailForm.subject" placeholder="Email subject" />
        </el-form-item>
  
        <el-form-item label="Text Content" prop="text">
          <el-input 
            v-model="emailForm.text" 
            type="textarea" 
            :rows="4"
            placeholder="Plain text content" />
        </el-form-item>
  
        <el-form-item label="HTML Content" prop="html">
          <el-input 
            v-model="emailForm.html" 
            type="textarea" 
            :rows="4"
            placeholder="HTML content" />
        </el-form-item>
  
        <el-form-item>
          <el-button type="primary" @click="submitForm">Test Email</el-button>
        </el-form-item>
      </el-form>
    </div>
  </template>
  
  <script>
  export default {
    name: 'EmailTestPage',
    data() {
      return {
        emailForm: {
          to: '',
          from: '',
          fromName: '',
          subject: '',
          text: '',
          html: ''
        },
        rules: {
          to: [
            { required: true, message: 'Recipient email is required', trigger: 'blur' },
            { type: 'email', message: 'Please enter a valid email', trigger: 'blur' }
          ],
          text: [
            { required: true, message: 'Text content is required', trigger: 'blur' }
          ]
        }
      }
    },
    methods: {
      async submitForm() {
        this.$refs.emailFormRef.validate(async (valid) => {
          if (valid) {
            // Prepare request data
            const requestData = {
              to: this.emailForm.to,
              subject: this.emailForm.subject,
              text: this.emailForm.text
            };

            // Add optional fields if they have values
            if (this.emailForm.html) {
              requestData.html = this.emailForm.html;
            }
            if (this.emailForm.from) {
              requestData.from = this.emailForm.from;
            }
            if (this.emailForm.fromName) {
              requestData.fromName = this.emailForm.fromName;
            }

            console.log('Making email request with data:', requestData);

            try {
              const response = await fetch('https://app.associateattorney.ai/api/sendemail', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
              });

              const data = await response.json();
              console.log('Email API response:', data);

              if (data.success) {
                ElMessage.success('Email sent successfully');
              } else {
                throw new Error(data.error || 'Failed to send email');
              }
            } catch (error) {
              console.error('Error sending email:', error);
              ElMessage.error('Failed to send email: ' + error.message);
            }
          }
        });
      }
    }
  }
  </script>
  
  <style scoped>
  .email-test-container {
    max-width: 600px;
    margin: 20px auto;
    padding: 20px;
  }
  </style>