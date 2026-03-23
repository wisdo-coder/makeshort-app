# Use Node LTS as the base image
FROM node:20-slim

# Install FFmpeg, Python, and the bleeding-edge version of yt-dlp
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Force install the absolute latest yt-dlp directly through Python
RUN pip3 install --upgrade yt-dlp --break-system-packages
# Set the working directory inside the container
WORKDIR /app

# Copy the package.json and install Node dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of our server code
COPY . .

# Expose port 5000 for our React frontend to talk to
EXPOSE 5000

# Start the server
CMD ["node", "index.js"]