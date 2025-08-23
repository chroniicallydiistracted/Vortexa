# Simple Dockerfile for SAM build (image-based Lambda) - local only
FROM public.ecr.aws/lambda/nodejs:18

# Copy function code
WORKDIR /var/task
COPY package.json package-lock.json* ./
RUN npm install --only=prod || true
COPY dist ./dist

# Command is provided in template metadata via image
CMD ["dist/index.handler"]
