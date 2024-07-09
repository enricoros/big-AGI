# Deploy `big-AGI` with Kubernetes ☸️

In this tutorial, we will guide you through the process of deploying big-AGI
in a Kubernetes environment using the kubectl command-line tool.

## First Deployment

### Step 1: Clone the big-AGI repository

```bash
$ git clone https://github.com/enricoros/big-agi
$ cd ./big-agi/docs/k8s
```

### Step 2: Create the namespace

```bash
$ kubectl create namespace ns-big-agi
```

### Step 3: Fill in the key information into env-secret.yaml

All variables are optional. By default, Kubernetes Secret uses Base64 for
encode/decode, so please don't do a git commit after filling in the keys
to avoid leaking sensitive information.

We provide an empty `env-secret.yaml` file as a template.
You can fill in the necessary information using a text editor.

```bash
$ nano env-secret.yaml
```

### Step 4: Deploying Kubernetes Resources

```bash
$ kubectl apply -f big-agi-deployment.yaml -f env-secret.yaml
```

### Step 5: Verifying the Resource Statuses

```bash
$ kubectl -n ns-big-agi get svc,pod,deployment
NAME                  TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)    AGE
service/svc-big-agi   ClusterIP   10.0.198.118   <none>        3000/TCP   63m

NAME                                     READY   STATUS    RESTARTS   AGE
pod/deployment-big-agi-xxxxxxxx-yyyyy    1/1     Running   0          39m

NAME                              READY   UP-TO-DATE   AVAILABLE   AGE
deployment.apps/deployment-big-agi   1/1     1            1           63m
```

### Step 6: Testing the Service

You can test the service by port-forwarding the service to your local machine:

```bash
$ kubectl -n ns-big-agi port-forward service/svc-big-agi 3000
Forwarding from 127.0.0.1:3000 -> 3000
Forwarding from [::1]:3000 -> 3000
```

Now you can access the service at `http://localhost:3000`, and you should see the big-AGI homepage.

## Updating big-AGI

To update big-AGI to the latest version:

1. Pull the latest changes from the repository:
   ```bash
   $ git pull origin main
   ```

2. Apply the updated deployment:
   ```bash
   $ kubectl apply -f big-agi-deployment.yaml
   ```

This will trigger a rolling update of the deployment with the latest image.

**Note**: If you're deploying big-AGI behind a reverse proxy, you may need to configure
your proxy to support streaming. See our [Reverse Proxy Deployment Guide](deploy-reverse-proxy.md) for more information.

Note: For production use, consider setting up an Ingress Controller or Load Balancer instead of using port-forward.