# Use Node LTS
FROM node:20-slim

# Set working directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the React code
COPY . .

# Expose the React development port
EXPOSE 3000

# Start the React development server
CMD ["npm", "start"]