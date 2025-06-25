#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored messages
print_message() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi
}

# Function to build and start containers
start() {
    print_message "Building and starting containers..."
    docker-compose up --build -d
}

# Function to stop containers
stop() {
    print_message "Stopping containers..."
    docker-compose down
}

# Function to view logs
logs() {
    print_message "Viewing logs..."
    docker-compose logs -f
}

# Function to restart containers
restart() {
    print_message "Restarting containers..."
    docker-compose restart
}

# Function to check container status
status() {
    print_message "Container status:"
    docker-compose ps
}

# Function to clean up
cleanup() {
    print_message "Cleaning up Docker resources..."
    docker-compose down -v
    docker system prune -f
}

# Main script
case "$1" in
    "start")
        check_docker
        start
        ;;
    "stop")
        check_docker
        stop
        ;;
    "logs")
        check_docker
        logs
        ;;
    "restart")
        check_docker
        restart
        ;;
    "status")
        check_docker
        status
        ;;
    "cleanup")
        check_docker
        cleanup
        ;;
    *)
        echo "Usage: $0 {start|stop|logs|restart|status|cleanup}"
        exit 1
        ;;
esac

exit 0 