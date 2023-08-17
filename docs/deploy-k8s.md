# Deploy `big-AGI` with Kubernetes ☸️

In this tutorial, we will guide you through the process of deploying a service, Pod, and Deployment in a Kubernetes environment using the kubectl command-line tool.

## Step 1: Clone the big-AGI repository

```bash
$ git clone https://github.com/enricoros/big-agi
$ cd ./big-agi/k8s
```

## Step 2: Fill in the necessary key information into env-secrert.yaml

By default, Kubernetes Secrert uses Base64 for encode/encode, so please don't do a git commit after filling in the key to avoid the key leaking. Also, you don't need to fill in all the following parameters, just fill in the necessary ones, just like in `.env.example`.

```bash
$ vim env-secrert.yaml
$ cat env-secret.yaml
---
apiVersion: v1
kind: Secret
metadata:
  name: env
  namespace: big-agi
type: Opaque
stringData:
  ANTHROPIC_API_HOST: ""
  ANTHROPIC_API_KEY: ""
  ELEVENLABS_API_HOST: ""
  ELEVENLABS_API_KEY: ""
  ELEVENLABS_VOICE_ID: ""
  GOOGLE_CLOUD_API_KEY: ""
  GOOGLE_CSE_ID: ""
  HELICONE_API_KEY: ""
  OPENAI_API_HOST: "api.openai.com"
  OPENAI_API_KEY: "sk-xxxxxxxxxxxx"
  OPENAI_API_ORG_ID: ""
  PRODIA_API_KEY: ""
```

## Step 3: Deploy the Kubernetes resources

By default, all kubernetes resource will be placed in `namespace: big-agi` instead of `namespace: default`. Be sure to switch the correct namespace to see the resources.

```bash
$ kubectl apply -f big-agi-deployment.yaml -f env-secret.yaml
```

## Step 4: Check Resource Status

The following are the normal outputs, if you encounter abnormal outputs, the you can refer to [Kubernetes - Debug Pods][1].

```bash
$ kubectl -n big-agi get svc,pod,deployment
NAME              TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)    AGE
service/big-agi   ClusterIP   10.0.198.118   <none>        3000/TCP   63m

NAME                          READY   STATUS    RESTARTS   AGE
pod/big-agi-d4f5d8b7b-jzvq4   1/1     Running   0          39m

NAME                      READY   UP-TO-DATE   AVAILABLE   AGE
deployment.apps/big-agi   1/1     1            1           63m
```

## Step 5: Test the Service

The main purpose of the `kubectl port-forward` is to test that big-AGI works properly in Kubernetes, not to formailize itstuse in an production environment.

If you are looking for a way to expose big-AGI as an public service, see [Kubernetes - Ingress Controller][2] or [Kubernetes - Load Balancer][3].

```bash
$ kubectl -n big-agi port-forward service/big-agi 3000
Forwarding from 127.0.0.1:3000 -> 3000
Forwarding from [::1]:3000 -> 3000

# Open the browser and go to http://localhost:3000 and you should see the big-agi web page
```

[1]: https://kubernetes.io/docs/tasks/debug/debug-application/debug-pods/
[2]: https://kubernetes.io/docs/concepts/services-networking/ingress-controllers/
[3]: https://kubernetes.io/docs/tasks/access-application-cluster/create-external-load-balancer/